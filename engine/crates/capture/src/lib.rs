//! OpenNDR Network Capture & Analysis Engine (V0.2)
//!
//! Intègre :
//! - Décodeur protocolaire hiérarchique L2 à L4 (`decoder`)
//! - Ingestion et écriture rotative de fichiers PCAP/PCAPNG (`pcap`)
//! - Capture réseau passive native Linux via `AF_PACKET` (`PACKET_MMAP` TPACKET_V2) (`afpacket`)
//! - Calcul des métriques de débit, pertes noyau et résumés de paquets en temps réel

pub mod afpacket;
pub mod decoder;
pub mod pcap;

use afpacket::AfPacketSocket;
use decoder::{decode_packet, ProtocolKind};
use openndr_common::{
    validate_capture_interface_isolation, EngineTelemetry, OpenNdrError, PacketSummary,
    PcapIngestionResult, ProtocolStats,
};
use pcap::{ingest_pcap_file, RotatingPcapWriter};
use std::collections::VecDeque;
use std::net::IpAddr;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const MAX_RECENT_PACKETS: usize = 100;

#[derive(Debug, Clone)]
pub struct CaptureConfig {
    pub interface_name: String,
    pub buffer_size_mb: usize,
    pub pcap_dump_dir: Option<String>,
    pub max_storage_gb: u64,
    pub promisc_mode: bool,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            interface_name: "eth1".to_string(),
            buffer_size_mb: 256,
            pcap_dump_dir: Some("/var/lib/openndr/captures".to_string()),
            max_storage_gb: 500,
            promisc_mode: true,
        }
    }
}

pub struct CaptureEngine {
    config: CaptureConfig,
    is_running: Arc<AtomicBool>,
    packets_received: Arc<Mutex<u64>>,
    packets_dropped: Arc<Mutex<u64>>,
    bytes_processed: Arc<Mutex<u64>>,
    protocol_stats: Arc<Mutex<ProtocolStats>>,
    current_mbps: Arc<Mutex<f64>>,
    ring_buffer_usage_pct: Arc<Mutex<f32>>,
    last_capture_file: Arc<Mutex<Option<String>>>,
    capture_mode: Arc<Mutex<String>>,
    recent_packets: Arc<Mutex<VecDeque<PacketSummary>>>,
    writer: Arc<Mutex<Option<RotatingPcapWriter>>>,
}

impl CaptureEngine {
    pub fn new(config: CaptureConfig) -> Self {
        Self {
            config,
            is_running: Arc::new(AtomicBool::new(false)),
            packets_received: Arc::new(Mutex::new(0)),
            packets_dropped: Arc::new(Mutex::new(0)),
            bytes_processed: Arc::new(Mutex::new(0)),
            protocol_stats: Arc::new(Mutex::new(ProtocolStats::default())),
            current_mbps: Arc::new(Mutex::new(0.0)),
            ring_buffer_usage_pct: Arc::new(Mutex::new(0.0)),
            last_capture_file: Arc::new(Mutex::new(None)),
            capture_mode: Arc::new(Mutex::new("STANDBY".to_string())),
            recent_packets: Arc::new(Mutex::new(VecDeque::with_capacity(MAX_RECENT_PACKETS))),
            writer: Arc::new(Mutex::new(None)),
        }
    }

    /// Démarre la capture réseau passive réelle sur l'interface configurée
    pub fn start(&mut self, ip_check: Option<IpAddr>, is_promisc: bool) -> Result<(), OpenNdrError> {
        self.start_on_interface(&self.config.interface_name.clone(), ip_check, is_promisc)
    }

    /// Démarre la capture réseau passive réelle sur une interface spécifique
    pub fn start_on_interface(
        &mut self,
        interface: &str,
        ip_check: Option<IpAddr>,
        is_promisc: bool,
    ) -> Result<(), OpenNdrError> {
        // Validation stricte d'isolation (aucune IP autorisée en capture passive)
        validate_capture_interface_isolation(interface, ip_check, is_promisc)?;

        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.config.interface_name = interface.to_string();

        // Préparation du writer rotatif PCAP si configuré
        if let Some(dump_dir) = &self.config.pcap_dump_dir {
            let writer = RotatingPcapWriter::new(dump_dir, 50, self.config.max_storage_gb)?;
            *self.last_capture_file.lock().unwrap() = writer.current_file_path();
            *self.writer.lock().unwrap() = Some(writer);
        }

        let mut socket =
            AfPacketSocket::open(interface, is_promisc, self.config.buffer_size_mb)?;

        self.is_running.store(true, Ordering::SeqCst);
        *self.capture_mode.lock().unwrap() = socket.capture_mode_name().to_string();

        let running_flag = self.is_running.clone();
        let pkt_cnt = self.packets_received.clone();
        let drop_cnt = self.packets_dropped.clone();
        let byte_cnt = self.bytes_processed.clone();
        let proto_stats = self.protocol_stats.clone();
        let mbps_stat = self.current_mbps.clone();
        let ring_pct_stat = self.ring_buffer_usage_pct.clone();
        let recent_ref = self.recent_packets.clone();
        let writer_ref = self.writer.clone();

        // Thread de capture haute performance en arrière-plan
        std::thread::spawn(move || {
            let mut last_calc_time = Instant::now();
            let mut bytes_since_last_calc = 0u64;

            while running_flag.load(Ordering::SeqCst) {
                match socket.recv_packet() {
                    Ok(Some((raw_data, ts_us))) => {
                        let len = raw_data.len() as u64;
                        bytes_since_last_calc += len;

                        *pkt_cnt.lock().unwrap() += 1;
                        *byte_cnt.lock().unwrap() += len;

                        // Enregistrement dans le fichier PCAP rotatif
                        if let Ok(mut writer_opt) = writer_ref.lock() {
                            if let Some(w) = writer_opt.as_mut() {
                                let _ = w.write_packet(&raw_data, ts_us);
                            }
                        }

                        // Décodage protocolaire L2-L4 réel
                        if let Ok(decoded) = decode_packet(&raw_data, ts_us) {
                            {
                                let mut st = proto_stats.lock().unwrap();
                                if decoded.vlan.is_some() {
                                    st.vlan_packets += 1;
                                }
                                if decoded.ipv4.is_some() {
                                    st.ipv4_packets += 1;
                                }
                                if decoded.ipv6.is_some() {
                                    st.ipv6_packets += 1;
                                }

                                match decoded.protocol {
                                    ProtocolKind::Tcp => st.tcp_packets += 1,
                                    ProtocolKind::Udp => st.udp_packets += 1,
                                    ProtocolKind::Icmp => st.icmp_packets += 1,
                                    ProtocolKind::Arp => st.arp_packets += 1,
                                    ProtocolKind::Other => st.other_packets += 1,
                                }
                            }

                            let summary = decoded.to_summary();
                            let mut q = recent_ref.lock().unwrap();
                            if q.len() >= MAX_RECENT_PACKETS {
                                q.pop_front();
                            }
                            q.push_back(summary);
                        }
                    }
                    Ok(None) => {
                        // Timeout normal sans nouveau paquet
                    }
                    Err(e) => {
                        tracing::warn!("Erreur capture : {}", e);
                    }
                }

                // Calcul du débit instantané, stats noyau & occupation du ring buffer toutes les secondes
                let elapsed = last_calc_time.elapsed();
                if elapsed >= Duration::from_secs(1) {
                    let secs = elapsed.as_secs_f64();
                    let mbps = (bytes_since_last_calc as f64 * 8.0) / (secs * 1_000_000.0);
                    *mbps_stat.lock().unwrap() = mbps;
                    *ring_pct_stat.lock().unwrap() = socket.ring_buffer_usage_pct();

                    let kstats = socket.kernel_stats();
                    if kstats.tp_drops > 0 {
                        *drop_cnt.lock().unwrap() += kstats.tp_drops as u64;
                    }

                    bytes_since_last_calc = 0;
                    last_calc_time = Instant::now();
                }
            }
            *ring_pct_stat.lock().unwrap() = 0.0;
        });

        Ok(())
    }

    /// Stoppe la capture réseau
    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        *self.capture_mode.lock().unwrap() = "STANDBY".to_string();
        *self.current_mbps.lock().unwrap() = 0.0;
        *self.ring_buffer_usage_pct.lock().unwrap() = 0.0;
        if let Ok(mut w) = self.writer.lock() {
            *w = None;
        }
    }

    /// Ingère un fichier PCAP ou PCAPNG et met à jour la télémétrie
    pub fn ingest_file<P: AsRef<Path>>(
        &self,
        path: P,
    ) -> Result<PcapIngestionResult, OpenNdrError> {
        let (result, _) = ingest_pcap_file(path)?;

        *self.packets_received.lock().unwrap() += result.packets_processed;
        *self.bytes_processed.lock().unwrap() += result.bytes_processed;

        {
            let mut st = self.protocol_stats.lock().unwrap();
            st.tcp_packets += result.protocol_stats.tcp_packets;
            st.udp_packets += result.protocol_stats.udp_packets;
            st.icmp_packets += result.protocol_stats.icmp_packets;
            st.arp_packets += result.protocol_stats.arp_packets;
            st.ipv4_packets += result.protocol_stats.ipv4_packets;
            st.ipv6_packets += result.protocol_stats.ipv6_packets;
            st.vlan_packets += result.protocol_stats.vlan_packets;
            st.other_packets += result.protocol_stats.other_packets;
        }

        {
            let mut q = self.recent_packets.lock().unwrap();
            for summary in &result.packet_summaries {
                if q.len() >= MAX_RECENT_PACKETS {
                    q.pop_front();
                }
                q.push_back(summary.clone());
            }
        }

        *self.last_capture_file.lock().unwrap() = Some(result.file_path.clone());
        *self.capture_mode.lock().unwrap() = "PCAP_INGESTION".to_string();

        Ok(result)
    }

    /// Récupère la télémétrie complète du moteur
    pub fn get_telemetry(&self) -> EngineTelemetry {
        let is_run = self.is_running.load(Ordering::SeqCst);
        EngineTelemetry {
            engine_version: "0.2.0".to_string(),
            is_running: is_run,
            capture_mode: self.capture_mode.lock().unwrap().clone(),
            active_interface: if is_run {
                Some(self.config.interface_name.clone())
            } else {
                None
            },
            packets_received: *self.packets_received.lock().unwrap(),
            packets_dropped: *self.packets_dropped.lock().unwrap(),
            bytes_processed: *self.bytes_processed.lock().unwrap(),
            current_mbps: *self.current_mbps.lock().unwrap(),
            ring_buffer_usage_pct: *self.ring_buffer_usage_pct.lock().unwrap(),
            protocol_stats: self.protocol_stats.lock().unwrap().clone(),
            last_capture_file: self.last_capture_file.lock().unwrap().clone(),
            recent_packets: self.recent_packets.lock().unwrap().iter().cloned().collect(),
        }
    }
}
