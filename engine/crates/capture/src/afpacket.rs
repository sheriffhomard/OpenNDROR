//! Capture réseau passive Linux via AF_PACKET (V0.2)
//!
//! Implémente :
//! - Mode haute performance `PACKET_MMAP` (`TPACKET_V2` zero-copy ring buffer via `PACKET_RX_RING` + `mmap`)
//! - Repli automatique sécurisé vers `SOCK_RAW` `recv()` si le noyau/conteneur refuse le mmap ring
//! - Statistiques noyau réelles via `PACKET_STATISTICS` (paquets reçus / perdus)

use openndr_common::OpenNdrError;
use std::ffi::CString;
use std::os::unix::io::RawFd;
use std::ptr;
use std::sync::atomic::{fence, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "linux")]
const PACKET_RX_RING: libc::c_int = 5;
#[cfg(target_os = "linux")]
const PACKET_STATISTICS: libc::c_int = 6;
#[cfg(target_os = "linux")]
const PACKET_VERSION: libc::c_int = 10;
#[cfg(target_os = "linux")]
const TPACKET_V2: libc::c_int = 1;
#[cfg(target_os = "linux")]
const TP_STATUS_KERNEL: u32 = 0;
#[cfg(target_os = "linux")]
const TP_STATUS_USER: u32 = 1;

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct TpacketReq {
    tp_block_size: u32,
    tp_block_nr: u32,
    tp_frame_size: u32,
    tp_frame_nr: u32,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct Tpacket2Hdr {
    tp_status: u32,
    tp_len: u32,
    tp_snaplen: u32,
    tp_mac: u16,
    tp_net: u16,
    tp_sec: u32,
    tp_nsec: u32,
    tp_vlan_tci: u16,
    tp_vlan_tpid: u16,
    tp_padding: [u8; 4],
}

#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct KernelPacketStats {
    pub tp_packets: u32,
    pub tp_drops: u32,
}

struct MmapRing {
    ptr: *mut u8,
    total_size: usize,
    frame_size: usize,
    frame_nr: usize,
    current_idx: usize,
}

// SAFETY: Le ring buffer mmap est détenu exclusivement par le thread de capture AfPacketSocket.
unsafe impl Send for MmapRing {}

pub struct AfPacketSocket {
    fd: RawFd,
    iface_name: String,
    #[allow(dead_code)]
    iface_index: i32,
    ring: Option<MmapRing>,
    fallback_buffer: Vec<u8>,
}

impl AfPacketSocket {
    /// Ouvre une socket AF_PACKET sur l'interface spécifiée avec tentative de ring buffer PACKET_MMAP
    pub fn open(interface: &str, promisc: bool, buffer_size_mb: usize) -> Result<Self, OpenNdrError> {
        #[cfg(target_os = "linux")]
        {
            use libc::{
                c_int, c_void, if_nametoindex, mmap, setsockopt, sockaddr_ll, socklen_t, AF_PACKET,
                ETH_P_ALL, MAP_FAILED, MAP_LOCKED, MAP_SHARED, PACKET_ADD_MEMBERSHIP,
                PACKET_MR_PROMISC, PROT_READ, PROT_WRITE, SOCK_RAW, SOL_PACKET,
            };

            let c_iface = CString::new(interface).map_err(|_| {
                OpenNdrError::InvalidInterface(format!("Nom d'interface invalide : {}", interface))
            })?;

            let ifindex = unsafe { if_nametoindex(c_iface.as_ptr()) };
            if ifindex == 0 {
                return Err(OpenNdrError::InvalidInterface(format!(
                    "Interface réseau {} introuvable sur le système",
                    interface
                )));
            }

            let protocol = (ETH_P_ALL as u16).to_be() as c_int;
            let fd = unsafe { libc::socket(AF_PACKET, SOCK_RAW, protocol) };

            if fd < 0 {
                let err = std::io::Error::last_os_error();
                return Err(OpenNdrError::InvalidInterface(format!(
                    "Échec création AF_PACKET sur {} : {} (Vérifiez les permissions root ou CAP_NET_RAW)",
                    interface, err
                )));
            }

            // Tentative d'activation PACKET_MMAP (TPACKET_V2)
            let mut ring_opt: Option<MmapRing> = None;
            let version = TPACKET_V2;
            let ver_res = unsafe {
                setsockopt(
                    fd,
                    SOL_PACKET,
                    PACKET_VERSION,
                    &version as *const c_int as *const c_void,
                    std::mem::size_of::<c_int>() as socklen_t,
                )
            };

            if ver_res == 0 {
                // Dimensionnement du ring buffer : blocs de 64 Ko, frames de 4 Ko (ou 2 Ko)
                let frame_size: u32 = 4096;
                let block_size: u32 = 65536; // 16 frames par bloc
                let target_bytes = (buffer_size_mb.clamp(1, 256)) * 1024 * 1024;
                let block_nr = ((target_bytes as u32) / block_size).max(4);
                let frame_nr = block_nr * (block_size / frame_size);

                let req = TpacketReq {
                    tp_block_size: block_size,
                    tp_block_nr: block_nr,
                    tp_frame_size: frame_size,
                    tp_frame_nr: frame_nr,
                };

                let ring_res = unsafe {
                    setsockopt(
                        fd,
                        SOL_PACKET,
                        PACKET_RX_RING,
                        &req as *const TpacketReq as *const c_void,
                        std::mem::size_of::<TpacketReq>() as socklen_t,
                    )
                };

                if ring_res == 0 {
                    let total_size = (block_size as usize) * (block_nr as usize);
                    let mapped = unsafe {
                        mmap(
                            ptr::null_mut(),
                            total_size,
                            PROT_READ | PROT_WRITE,
                            MAP_SHARED | MAP_LOCKED,
                            fd,
                            0,
                        )
                    };
                    // Réessayer sans MAP_LOCKED si rlimit memlock est restreint
                    let mapped = if mapped == MAP_FAILED {
                        unsafe {
                            mmap(
                                ptr::null_mut(),
                                total_size,
                                PROT_READ | PROT_WRITE,
                                MAP_SHARED,
                                fd,
                                0,
                            )
                        }
                    } else {
                        mapped
                    };

                    if mapped != MAP_FAILED {
                        tracing::info!(
                            "Ring buffer PACKET_MMAP TPACKET_V2 actif sur {} ({} Mo, {} frames)",
                            interface,
                            total_size / (1024 * 1024),
                            frame_nr
                        );
                        ring_opt = Some(MmapRing {
                            ptr: mapped as *mut u8,
                            total_size,
                            frame_size: frame_size as usize,
                            frame_nr: frame_nr as usize,
                            current_idx: 0,
                        });
                    }
                }
            }

            // Bind sur l'interface après configuration du ring
            let mut sll: sockaddr_ll = unsafe { std::mem::zeroed() };
            sll.sll_family = AF_PACKET as u16;
            sll.sll_protocol = (ETH_P_ALL as u16).to_be();
            sll.sll_ifindex = ifindex as c_int;

            let bind_res = unsafe {
                libc::bind(
                    fd,
                    &sll as *const sockaddr_ll as *const libc::sockaddr,
                    std::mem::size_of::<sockaddr_ll>() as socklen_t,
                )
            };

            if bind_res < 0 {
                let err = std::io::Error::last_os_error();
                if let Some(r) = ring_opt {
                    unsafe { libc::munmap(r.ptr as *mut c_void, r.total_size) };
                }
                unsafe { libc::close(fd) };
                return Err(OpenNdrError::InvalidInterface(format!(
                    "Échec bind AF_PACKET sur interface {} : {}",
                    interface, err
                )));
            }

            // Activation du mode promiscuité via setsockopt PACKET_ADD_MEMBERSHIP
            if promisc {
                #[repr(C)]
                struct PacketMreq {
                    mr_ifindex: c_int,
                    mr_type: u16,
                    mr_alen: u16,
                    mr_address: [u8; 8],
                }

                let mreq = PacketMreq {
                    mr_ifindex: ifindex as c_int,
                    mr_type: PACKET_MR_PROMISC as u16,
                    mr_alen: 0,
                    mr_address: [0u8; 8],
                };

                let opt_res = unsafe {
                    setsockopt(
                        fd,
                        SOL_PACKET,
                        PACKET_ADD_MEMBERSHIP,
                        &mreq as *const PacketMreq as *const c_void,
                        std::mem::size_of::<PacketMreq>() as socklen_t,
                    )
                };

                if opt_res < 0 {
                    let err = std::io::Error::last_os_error();
                    tracing::warn!(
                        "Avertissement : impossible d'activer le mode promiscuité matériel sur {} : {}",
                        interface,
                        err
                    );
                }
            }

            // Timeout de réception (100ms) pour le mode fallback recv()
            let timeout = libc::timeval {
                tv_sec: 0,
                tv_usec: 100_000,
            };
            unsafe {
                libc::setsockopt(
                    fd,
                    libc::SOL_SOCKET,
                    libc::SO_RCVTIMEO,
                    &timeout as *const libc::timeval as *const c_void,
                    std::mem::size_of::<libc::timeval>() as socklen_t,
                );
            }

            Ok(Self {
                fd,
                iface_name: interface.to_string(),
                iface_index: ifindex as i32,
                ring: ring_opt,
                fallback_buffer: vec![0u8; 65536],
            })
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (interface, promisc, buffer_size_mb);
            Err(OpenNdrError::InvalidInterface(
                "La capture native AF_PACKET n'est supportée que sous Linux (Debian 13)".to_string(),
            ))
        }
    }

    pub fn capture_mode_name(&self) -> &'static str {
        if self.ring.is_some() {
            "AF_PACKET_MMAP"
        } else {
            "AF_PACKET_RAW"
        }
    }

    /// Retourne les compteurs réels de paquets reçus et perdus du noyau Linux
    pub fn kernel_stats(&self) -> KernelPacketStats {
        #[cfg(target_os = "linux")]
        {
            let mut stats = KernelPacketStats::default();
            let mut len = std::mem::size_of::<KernelPacketStats>() as libc::socklen_t;
            let res = unsafe {
                libc::getsockopt(
                    self.fd,
                    libc::SOL_PACKET,
                    PACKET_STATISTICS,
                    &mut stats as *mut KernelPacketStats as *mut libc::c_void,
                    &mut len,
                )
            };
            if res == 0 {
                return stats;
            }
        }
        KernelPacketStats::default()
    }

    /// Pourcentage réel d'occupation du ring buffer (frames en attente de lecture)
    pub fn ring_buffer_usage_pct(&self) -> f32 {
        #[cfg(target_os = "linux")]
        if let Some(ring) = &self.ring {
            let mut pending = 0usize;
            // Échantillonnage rapide sur jusqu'à 256 slots pour rester O(1)
            let sample_count = ring.frame_nr.min(256);
            let step = (ring.frame_nr / sample_count).max(1);
            let mut sampled = 0usize;
            let mut idx = ring.current_idx;
            for _ in 0..sample_count {
                let hdr_ptr = unsafe { ring.ptr.add(idx * ring.frame_size) as *const Tpacket2Hdr };
                let status = unsafe { ptr::read_volatile(&(*hdr_ptr).tp_status) };
                if (status & TP_STATUS_USER) != 0 {
                    pending += 1;
                }
                sampled += 1;
                idx = (idx + step) % ring.frame_nr;
            }
            if sampled > 0 {
                return ((pending as f32) / (sampled as f32)) * 100.0;
            }
        }
        0.0
    }

    /// Lit le paquet suivant (zero-copy mmap ring si disponible, sinon recv raw)
    pub fn recv_packet(&mut self) -> Result<Option<(Vec<u8>, u64)>, OpenNdrError> {
        #[cfg(target_os = "linux")]
        {
            if let Some(ring) = &mut self.ring {
                let frame_ptr = unsafe { ring.ptr.add(ring.current_idx * ring.frame_size) };
                let hdr_ptr = frame_ptr as *mut Tpacket2Hdr;

                let status = unsafe { ptr::read_volatile(&(*hdr_ptr).tp_status) };
                if (status & TP_STATUS_USER) == 0 {
                    // Attente courte via poll(100ms) pour éviter le busy-wait
                    let mut pfd = libc::pollfd {
                        fd: self.fd,
                        events: libc::POLLIN,
                        revents: 0,
                    };
                    let poll_res = unsafe { libc::poll(&mut pfd, 1, 100) };
                    if poll_res <= 0 {
                        return Ok(None);
                    }
                    let status_after = unsafe { ptr::read_volatile(&(*hdr_ptr).tp_status) };
                    if (status_after & TP_STATUS_USER) == 0 {
                        return Ok(None);
                    }
                }

                fence(Ordering::Acquire);
                let hdr = unsafe { *hdr_ptr };
                let mac_offset = hdr.tp_mac as usize;
                let snaplen = hdr.tp_snaplen as usize;

                let pkt_data = if mac_offset + snaplen <= ring.frame_size && snaplen > 0 {
                    let slice = unsafe {
                        std::slice::from_raw_parts(frame_ptr.add(mac_offset), snaplen)
                    };
                    slice.to_vec()
                } else {
                    Vec::new()
                };

                let ts_us = (hdr.tp_sec as u64) * 1_000_000 + (hdr.tp_nsec as u64) / 1_000;

                // Restituer la frame au noyau
                fence(Ordering::Release);
                unsafe {
                    ptr::write_volatile(&mut (*hdr_ptr).tp_status, TP_STATUS_KERNEL);
                }
                ring.current_idx = (ring.current_idx + 1) % ring.frame_nr;

                if pkt_data.is_empty() {
                    return Ok(None);
                }
                return Ok(Some((pkt_data, ts_us)));
            }

            // Repli standard SOCK_RAW recv()
            let n = unsafe {
                libc::recv(
                    self.fd,
                    self.fallback_buffer.as_mut_ptr() as *mut libc::c_void,
                    self.fallback_buffer.len(),
                    0,
                )
            };

            if n > 0 {
                let now_us = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_micros() as u64;
                let data = self.fallback_buffer[..n as usize].to_vec();
                Ok(Some((data, now_us)))
            } else if n < 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::WouldBlock
                    || err.kind() == std::io::ErrorKind::TimedOut
                    || err.raw_os_error() == Some(libc::EAGAIN)
                {
                    Ok(None)
                } else {
                    Err(OpenNdrError::BufferOverflow(format!(
                        "Erreur lecture AF_PACKET : {}",
                        err
                    )))
                }
            } else {
                Ok(None)
            }
        }
        #[cfg(not(target_os = "linux"))]
        {
            Ok(None)
        }
    }

    pub fn interface_name(&self) -> &str {
        &self.iface_name
    }
}

impl Drop for AfPacketSocket {
    fn drop(&mut self) {
        #[cfg(target_os = "linux")]
        {
            if let Some(ring) = self.ring.take() {
                unsafe { libc::munmap(ring.ptr as *mut libc::c_void, ring.total_size) };
            }
            if self.fd >= 0 {
                unsafe { libc::close(self.fd) };
            }
        }
    }
}
