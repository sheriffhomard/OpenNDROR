//! Module d'ingestion et d'écriture de fichiers PCAP et PCAPNG (V0.2)
//!
//! Fournit :
//! - `PcapReader` : Lecture synchrone/itérative de traces `.pcap` et `.pcapng`.
//! - `RotatingPcapWriter` : Écriture de captures locales rotatives avec gestion de quota.

use crate::decoder::{decode_packet, DecodedPacket};
use openndr_common::{OpenNdrError, PcapIngestionResult, ProtocolStats};
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const PCAP_MAGIC_BYTES_MICRO_BE: [u8; 4] = [0xa1, 0xb2, 0xc3, 0xd4];
const PCAP_MAGIC_BYTES_MICRO_LE: [u8; 4] = [0xd4, 0xc3, 0xb2, 0xa1];
const PCAP_MAGIC_BYTES_NANO_BE: [u8; 4] = [0xa1, 0xb2, 0x3c, 0x4d];
const PCAP_MAGIC_BYTES_NANO_LE: [u8; 4] = [0x4d, 0x3c, 0xb2, 0xa1];
const PCAPNG_SECTION_HEADER: [u8; 4] = [0x0a, 0x0d, 0x0d, 0x0a];

/// Paquet brut extrait d'une trace
#[derive(Debug, Clone)]
pub struct RawPacket {
    pub timestamp_us: u64,
    pub original_len: usize,
    pub data: Vec<u8>,
}

/// Lecteur de fichiers de traces réseau PCAP / PCAPNG
pub struct PcapReader<R: Read> {
    reader: R,
    is_big_endian: bool,
    is_nanosecond: bool,
    is_pcapng: bool,
    #[allow(dead_code)]
    link_type: u32,
    #[allow(dead_code)]
    snaplen: u32,
}

impl PcapReader<BufReader<File>> {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, OpenNdrError> {
        let file = File::open(path.as_ref()).map_err(|e| {
            OpenNdrError::PcapError(format!(
                "Impossible d'ouvrir le fichier PCAP {}: {}",
                path.as_ref().display(),
                e
            ))
        })?;
        let buf_reader = BufReader::new(file);
        Self::new(buf_reader)
    }
}

impl<R: Read> PcapReader<R> {
    pub fn new(mut reader: R) -> Result<Self, OpenNdrError> {
        let mut magic = [0u8; 4];
        reader.read_exact(&mut magic).map_err(|e| {
            OpenNdrError::PcapError(format!("Fichier vide ou en-tête manquant : {}", e))
        })?;

        if magic == PCAPNG_SECTION_HEADER {
            // Fichier PCAPNG : Lecture du bloc SHB (minimum 28 octets)
            let mut shb_hdr = [0u8; 24];
            reader.read_exact(&mut shb_hdr).map_err(|e| {
                OpenNdrError::PcapError(format!("Section Header Block PCAPNG corrompu : {}", e))
            })?;
            let bom = u32::from_be_bytes([shb_hdr[4], shb_hdr[5], shb_hdr[6], shb_hdr[7]]);
            let is_be = bom == 0x1a2b3c4d;
            let shb_len = if is_be {
                u32::from_be_bytes([shb_hdr[0], shb_hdr[1], shb_hdr[2], shb_hdr[3]])
            } else {
                u32::from_le_bytes([shb_hdr[0], shb_hdr[1], shb_hdr[2], shb_hdr[3]])
            };
            if shb_len > 28 {
                let extra = (shb_len - 28) as usize;
                let mut discard = vec![0u8; extra];
                reader.read_exact(&mut discard).map_err(|e| {
                    OpenNdrError::PcapError(format!("Options SHB PCAPNG tronquées : {}", e))
                })?;
            }

            return Ok(Self {
                reader,
                is_big_endian: is_be,
                is_nanosecond: true,
                is_pcapng: true,
                link_type: 1, // Standard Ethernet
                snaplen: 65535,
            });
        }

        // Fichier PCAP standard
        let (is_big_endian, is_nanosecond) = if magic == PCAP_MAGIC_BYTES_MICRO_BE {
            (true, false)
        } else if magic == PCAP_MAGIC_BYTES_MICRO_LE {
            (false, false)
        } else if magic == PCAP_MAGIC_BYTES_NANO_BE {
            (true, true)
        } else if magic == PCAP_MAGIC_BYTES_NANO_LE {
            (false, true)
        } else {
            return Err(OpenNdrError::PcapError(format!(
                "Magic number PCAP non reconnu : {:02x}{:02x}{:02x}{:02x}",
                magic[0], magic[1], magic[2], magic[3]
            )));
        };

        // Lecture des 20 octets restants du Global Header
        let mut gh_bytes = [0u8; 20];
        reader.read_exact(&mut gh_bytes).map_err(|e| {
            OpenNdrError::PcapError(format!("En-tête global PCAP incomplet : {}", e))
        })?;

        let (snaplen, link_type) = if is_big_endian {
            let sl = u32::from_be_bytes([gh_bytes[12], gh_bytes[13], gh_bytes[14], gh_bytes[15]]);
            let lt = u32::from_be_bytes([gh_bytes[16], gh_bytes[17], gh_bytes[18], gh_bytes[19]]);
            (sl, lt)
        } else {
            let sl = u32::from_le_bytes([gh_bytes[12], gh_bytes[13], gh_bytes[14], gh_bytes[15]]);
            let lt = u32::from_le_bytes([gh_bytes[16], gh_bytes[17], gh_bytes[18], gh_bytes[19]]);
            (sl, lt)
        };

        Ok(Self {
            reader,
            is_big_endian,
            is_nanosecond,
            is_pcapng: false,
            link_type,
            snaplen,
        })
    }

    /// Lit le prochain paquet de la trace
    pub fn next_packet(&mut self) -> Option<Result<RawPacket, OpenNdrError>> {
        if self.is_pcapng {
            self.next_pcapng_packet()
        } else {
            self.next_pcap_packet()
        }
    }

    fn next_pcap_packet(&mut self) -> Option<Result<RawPacket, OpenNdrError>> {
        let mut hdr = [0u8; 16];
        match self.reader.read_exact(&mut hdr) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return None,
            Err(e) => return Some(Err(OpenNdrError::PcapError(e.to_string()))),
        }

        let (ts_sec, ts_frac, incl_len, orig_len) = if self.is_big_endian {
            (
                u32::from_be_bytes([hdr[0], hdr[1], hdr[2], hdr[3]]),
                u32::from_be_bytes([hdr[4], hdr[5], hdr[6], hdr[7]]),
                u32::from_be_bytes([hdr[8], hdr[9], hdr[10], hdr[11]]),
                u32::from_be_bytes([hdr[12], hdr[13], hdr[14], hdr[15]]),
            )
        } else {
            (
                u32::from_le_bytes([hdr[0], hdr[1], hdr[2], hdr[3]]),
                u32::from_le_bytes([hdr[4], hdr[5], hdr[6], hdr[7]]),
                u32::from_le_bytes([hdr[8], hdr[9], hdr[10], hdr[11]]),
                u32::from_le_bytes([hdr[12], hdr[13], hdr[14], hdr[15]]),
            )
        };

        // Conversion horodatage en microsecondes
        let timestamp_us = if self.is_nanosecond {
            (ts_sec as u64) * 1_000_000 + (ts_frac as u64) / 1_000
        } else {
            (ts_sec as u64) * 1_000_000 + (ts_frac as u64)
        };

        if incl_len > 65536 * 4 {
            return Some(Err(OpenNdrError::PcapError(format!(
                "Longueur de paquet suspecte : {}",
                incl_len
            ))));
        }

        let mut data = vec![0u8; incl_len as usize];
        if let Err(e) = self.reader.read_exact(&mut data) {
            return Some(Err(OpenNdrError::PcapError(format!(
                "Lecture du paquet tronquée : {}",
                e
            ))));
        }

        Some(Ok(RawPacket {
            timestamp_us,
            original_len: orig_len as usize,
            data,
        }))
    }

    fn next_pcapng_packet(&mut self) -> Option<Result<RawPacket, OpenNdrError>> {
        // Boucle sur les blocs PCAPNG jusqu'à trouver un Enhanced Packet Block (Type 0x00000006)
        loop {
            let mut block_hdr = [0u8; 8];
            match self.reader.read_exact(&mut block_hdr) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return None,
                Err(e) => return Some(Err(OpenNdrError::PcapError(e.to_string()))),
            }

            let block_type = if self.is_big_endian {
                u32::from_be_bytes([block_hdr[0], block_hdr[1], block_hdr[2], block_hdr[3]])
            } else {
                u32::from_le_bytes([block_hdr[0], block_hdr[1], block_hdr[2], block_hdr[3]])
            };
            let block_total_len = if self.is_big_endian {
                u32::from_be_bytes([block_hdr[4], block_hdr[5], block_hdr[6], block_hdr[7]])
            } else {
                u32::from_le_bytes([block_hdr[4], block_hdr[5], block_hdr[6], block_hdr[7]])
            };

            if block_total_len < 12 {
                return Some(Err(OpenNdrError::PcapError(
                    "Taille de bloc PCAPNG invalide (< 12 octets)".to_string(),
                )));
            }

            let body_len = (block_total_len - 12) as usize; // enlève type (4), len (4) et len de fin (4)
            let mut body = vec![0u8; body_len];
            if let Err(e) = self.reader.read_exact(&mut body) {
                return Some(Err(OpenNdrError::PcapError(e.to_string())));
            }
            // Lecture du block_total_len de fermeture
            let mut tail = [0u8; 4];
            let _ = self.reader.read_exact(&mut tail);

            if block_type == 0x00000006 && body_len >= 20 {
                // Enhanced Packet Block
                let ts_high = if self.is_big_endian {
                    u32::from_be_bytes([body[4], body[5], body[6], body[7]])
                } else {
                    u32::from_le_bytes([body[4], body[5], body[6], body[7]])
                };
                let ts_low = if self.is_big_endian {
                    u32::from_be_bytes([body[8], body[9], body[10], body[11]])
                } else {
                    u32::from_le_bytes([body[8], body[9], body[10], body[11]])
                };
                let cap_len = if self.is_big_endian {
                    u32::from_be_bytes([body[12], body[13], body[14], body[15]])
                } else {
                    u32::from_le_bytes([body[12], body[13], body[14], body[15]])
                } as usize;
                let orig_len = if self.is_big_endian {
                    u32::from_be_bytes([body[16], body[17], body[18], body[19]])
                } else {
                    u32::from_le_bytes([body[16], body[17], body[18], body[19]])
                } as usize;

                let ts_raw = ((ts_high as u64) << 32) | (ts_low as u64);

                if body.len() >= 20 + cap_len {
                    let pkt_data = body[20..20 + cap_len].to_vec();
                    return Some(Ok(RawPacket {
                        timestamp_us: ts_raw,
                        original_len: orig_len,
                        data: pkt_data,
                    }));
                }
            }
        }
    }
}

/// Écrivain PCAP rotatif avec gestion de l'espace disque
pub struct RotatingPcapWriter {
    pcap_dir: PathBuf,
    max_file_size_bytes: u64,
    max_storage_gb: u64,
    current_file: Option<BufWriter<File>>,
    current_file_path: Option<PathBuf>,
    current_file_size: u64,
    total_written_bytes: u64,
    total_packets: u64,
    segment_seq: u64,
}

impl RotatingPcapWriter {
    pub fn new<P: AsRef<Path>>(
        pcap_dir: P,
        max_file_size_mb: u64,
        max_storage_gb: u64,
    ) -> Result<Self, OpenNdrError> {
        Self::new_with_bytes_limit(pcap_dir, max_file_size_mb * 1024 * 1024, max_storage_gb)
    }

    pub fn new_with_bytes_limit<P: AsRef<Path>>(
        pcap_dir: P,
        max_file_size_bytes: u64,
        max_storage_gb: u64,
    ) -> Result<Self, OpenNdrError> {
        let dir = pcap_dir.as_ref().to_path_buf();
        fs::create_dir_all(&dir).map_err(|e| {
            OpenNdrError::PcapError(format!(
                "Impossible de créer le dossier de capture {}: {}",
                dir.display(),
                e
            ))
        })?;

        let mut writer = Self {
            pcap_dir: dir,
            max_file_size_bytes: max_file_size_bytes.max(64),
            max_storage_gb,
            current_file: None,
            current_file_path: None,
            current_file_size: 0,
            total_written_bytes: 0,
            total_packets: 0,
            segment_seq: 0,
        };

        writer.rotate_file()?;
        Ok(writer)
    }

    /// Enregistre un paquet dans le fichier PCAP actif
    pub fn write_packet(&mut self, data: &[u8], timestamp_us: u64) -> Result<(), OpenNdrError> {
        let packet_record_size = 16 + data.len() as u64;

        if self.current_file_size + packet_record_size > self.max_file_size_bytes {
            self.rotate_file()?;
        }

        let writer = match self.current_file.as_mut() {
            Some(w) => w,
            None => {
                self.rotate_file()?;
                self.current_file.as_mut().unwrap()
            }
        };

        let ts_sec = (timestamp_us / 1_000_000) as u32;
        let ts_usec = (timestamp_us % 1_000_000) as u32;
        let incl_len = data.len() as u32;
        let orig_len = data.len() as u32;

        let mut record_header = [0u8; 16];
        record_header[0..4].copy_from_slice(&ts_sec.to_le_bytes());
        record_header[4..8].copy_from_slice(&ts_usec.to_le_bytes());
        record_header[8..12].copy_from_slice(&incl_len.to_le_bytes());
        record_header[12..16].copy_from_slice(&orig_len.to_le_bytes());

        writer.write_all(&record_header).map_err(|e| {
            OpenNdrError::PcapError(format!("Erreur écriture header paquet : {}", e))
        })?;
        writer.write_all(data).map_err(|e| {
            OpenNdrError::PcapError(format!("Erreur écriture données paquet : {}", e))
        })?;

        self.current_file_size += packet_record_size;
        self.total_written_bytes += packet_record_size;
        self.total_packets += 1;

        Ok(())
    }

    /// Clôture le fichier en cours et ouvre un nouveau segment rotatif
    pub fn rotate_file(&mut self) -> Result<PathBuf, OpenNdrError> {
        if let Some(mut file) = self.current_file.take() {
            let _ = file.flush();
        }

        self.enforce_quota()?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.segment_seq += 1;
        let filename = format!("openndr_capture_{}_{:04}.pcap", now, self.segment_seq);
        let path = self.pcap_dir.join(filename);

        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)
            .map_err(|e| {
                OpenNdrError::PcapError(format!(
                    "Impossible de créer le segment PCAP {}: {}",
                    path.display(),
                    e
                ))
            })?;

        let mut buf_writer = BufWriter::new(file);

        // Écriture du Global Header standard (24 octets en Little Endian, Ethernet linktype = 1)
        let mut global_header = [0u8; 24];
        global_header[0..4].copy_from_slice(&PCAP_MAGIC_BYTES_MICRO_LE);
        global_header[4..6].copy_from_slice(&2u16.to_le_bytes()); // Major 2
        global_header[6..8].copy_from_slice(&4u16.to_le_bytes()); // Minor 4
        global_header[8..12].copy_from_slice(&0i32.to_le_bytes()); // Thiszone GMT
        global_header[12..16].copy_from_slice(&0u32.to_le_bytes()); // Sigfigs
        global_header[16..20].copy_from_slice(&65535u32.to_le_bytes()); // Snaplen
        global_header[20..24].copy_from_slice(&1u32.to_le_bytes()); // Network DLT_EN10MB Ethernet

        buf_writer.write_all(&global_header).map_err(|e| {
            OpenNdrError::PcapError(format!("Erreur écriture global header PCAP : {}", e))
        })?;
        buf_writer.flush().map_err(|e| {
            OpenNdrError::PcapError(format!("Erreur flush global header : {}", e))
        })?;

        self.current_file_path = Some(path.clone());
        self.current_file = Some(buf_writer);
        self.current_file_size = 24;

        Ok(path)
    }

    /// Supprime les plus anciens fichiers lorsque l'espace dépasse le quota
    fn enforce_quota(&self) -> Result<(), OpenNdrError> {
        let max_bytes = self.max_storage_gb * 1024 * 1024 * 1024;
        let mut files: Vec<(PathBuf, u64, SystemTime)> = Vec::new();
        let mut total_dir_size = 0u64;

        if let Ok(entries) = fs::read_dir(&self.pcap_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map_or(false, |ext| ext == "pcap" || ext == "pcapng") {
                    if let Ok(meta) = entry.metadata() {
                        let len = meta.len();
                        let mtime = meta.modified().unwrap_or(UNIX_EPOCH);
                        total_dir_size += len;
                        files.push((p, len, mtime));
                    }
                }
            }
        }

        // Tri du plus ancien au plus récent
        files.sort_by_key(|f| f.2);

        for (path, size, _) in files {
            if total_dir_size <= max_bytes {
                break;
            }
            if let Err(e) = fs::remove_file(&path) {
                tracing::warn!("Échec de suppression d'un ancien PCAP {}: {}", path.display(), e);
            } else {
                total_dir_size = total_dir_size.saturating_sub(size);
                tracing::info!("Quota PCAP appliqué : suppression de {}", path.display());
            }
        }

        Ok(())
    }

    pub fn current_file_path(&self) -> Option<String> {
        self.current_file_path.as_ref().map(|p| p.to_string_lossy().to_string())
    }

    pub fn total_packets(&self) -> u64 {
        self.total_packets
    }

    pub fn total_bytes(&self) -> u64 {
        self.total_written_bytes
    }
}

/// Analyse et ingère intégralement une trace PCAP ou PCAPNG
pub fn ingest_pcap_file<P: AsRef<Path>>(
    path: P,
) -> Result<(PcapIngestionResult, Vec<DecodedPacket>), OpenNdrError> {
    let p = path.as_ref();
    let metadata = fs::metadata(p).map_err(|e| {
        OpenNdrError::PcapError(format!("Fichier {} inaccessible : {}", p.display(), e))
    })?;

    let file_size_bytes = metadata.len();
    let mut reader = PcapReader::open(p)?;

    let mut packets = Vec::new();
    let mut stats = ProtocolStats::default();
    let mut total_bytes = 0u64;
    let mut first_ts = None;
    let mut last_ts = None;

    let start_instant = std::time::Instant::now();

    while let Some(packet_res) = reader.next_packet() {
        match packet_res {
            Ok(raw) => {
                total_bytes += raw.data.len() as u64;
                if first_ts.is_none() {
                    first_ts = Some(raw.timestamp_us);
                }
                last_ts = Some(raw.timestamp_us);

                if let Ok(decoded) = decode_packet(&raw.data, raw.timestamp_us) {
                    if decoded.vlan.is_some() {
                        stats.vlan_packets += 1;
                    }
                    if decoded.ipv4.is_some() {
                        stats.ipv4_packets += 1;
                    }
                    if decoded.ipv6.is_some() {
                        stats.ipv6_packets += 1;
                    }

                    match decoded.protocol {
                        crate::decoder::ProtocolKind::Tcp => stats.tcp_packets += 1,
                        crate::decoder::ProtocolKind::Udp => stats.udp_packets += 1,
                        crate::decoder::ProtocolKind::Icmp => stats.icmp_packets += 1,
                        crate::decoder::ProtocolKind::Arp => stats.arp_packets += 1,
                        crate::decoder::ProtocolKind::Other => stats.other_packets += 1,
                    }

                    packets.push(decoded);
                }
            }
            Err(e) => {
                tracing::warn!("Erreur lors de la lecture d'un paquet PCAP : {}", e);
            }
        }
    }

    let duration_seconds = start_instant.elapsed().as_secs_f64();
    let packet_summaries = packets.iter().take(200).map(|p| p.to_summary()).collect();

    let result = PcapIngestionResult {
        file_path: p.to_string_lossy().to_string(),
        file_size_bytes,
        packets_processed: packets.len() as u64,
        bytes_processed: total_bytes,
        duration_seconds,
        protocol_stats: stats,
        first_packet_timestamp: first_ts,
        last_packet_timestamp: last_ts,
        packet_summaries,
    };

    Ok((result, packets))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pcap_write_and_read_roundtrip() {
        let temp_dir = std::env::temp_dir().join(format!("openndr_pcap_test_{}", std::process::id()));
        let mut writer = RotatingPcapWriter::new(&temp_dir, 10, 1).expect("Init rotating writer");

        // Paquet test : Ethernet + ARP
        let test_packet = vec![
            0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x08, 0x06,
            0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, 0x01, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
            192, 168, 1, 10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 192, 168, 1, 1,
        ];

        writer.write_packet(&test_packet, 1_700_000_000_000).expect("Write packet");
        let pcap_file = writer.current_file_path().expect("File path exists");
        drop(writer);

        let mut reader = PcapReader::open(&pcap_file).expect("Open PCAP");
        let read_pkt = reader.next_packet().expect("Has next").expect("Packet is ok");

        assert_eq!(read_pkt.data, test_packet);
        assert_eq!(read_pkt.timestamp_us, 1_700_000_000_000);

        // Ingestion complète
        let (ingest_res, decoded_list) = ingest_pcap_file(&pcap_file).expect("Ingest PCAP");
        assert_eq!(ingest_res.packets_processed, 1);
        assert_eq!(ingest_res.protocol_stats.arp_packets, 1);
        assert_eq!(ingest_res.packet_summaries.len(), 1);
        assert_eq!(decoded_list.len(), 1);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_pcapng_ingestion() {
        let temp_file = std::env::temp_dir().join(format!("openndr_test_{}.pcapng", std::process::id()));

        // Construction d'un fichier PCAPNG valide (Little Endian): SHB + IDB + EPB (Ethernet + IPv4 UDP)
        let mut buf = Vec::new();
        // 1. Section Header Block (28 bytes)
        buf.extend_from_slice(&0x0a0d0d0au32.to_be_bytes());
        buf.extend_from_slice(&28u32.to_le_bytes());
        buf.extend_from_slice(&0x1a2b3c4du32.to_le_bytes()); // Byte-Order Magic LE
        buf.extend_from_slice(&1u16.to_le_bytes()); // Major 1
        buf.extend_from_slice(&0u16.to_le_bytes()); // Minor 0
        buf.extend_from_slice(&(-1i64).to_le_bytes()); // Section length unspecified
        buf.extend_from_slice(&28u32.to_le_bytes());

        // 2. Interface Description Block (20 bytes)
        buf.extend_from_slice(&0x00000001u32.to_le_bytes());
        buf.extend_from_slice(&20u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes()); // LinkType Ethernet
        buf.extend_from_slice(&0u16.to_le_bytes()); // Reserved
        buf.extend_from_slice(&65535u32.to_le_bytes()); // SnapLen
        buf.extend_from_slice(&20u32.to_le_bytes());

        // 3. Enhanced Packet Block (IPv4 UDP 42 bytes -> padded to 44 bytes; body = 20 + 44 = 64; total = 76)
        let udp_pkt = vec![
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0x08, 0x00,
            0x45, 0x00, 0x00, 0x1c, 0x00, 0x01, 0x00, 0x00, 0x40, 0x11, 0x00, 0x00, 10, 0, 0, 1, 10, 0, 0, 2,
            0xc0, 0x00, 0x00, 0x35, 0x00, 0x08, 0x00, 0x00,
        ];
        let epb_total: u32 = 12 + 20 + 44; // 76 bytes
        buf.extend_from_slice(&0x00000006u32.to_le_bytes());
        buf.extend_from_slice(&epb_total.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes()); // Interface ID
        buf.extend_from_slice(&0u32.to_le_bytes()); // TS High
        buf.extend_from_slice(&1_000_000u32.to_le_bytes()); // TS Low
        buf.extend_from_slice(&(udp_pkt.len() as u32).to_le_bytes()); // Captured len
        buf.extend_from_slice(&(udp_pkt.len() as u32).to_le_bytes()); // Original len
        buf.extend_from_slice(&udp_pkt);
        buf.extend_from_slice(&[0u8; 2]); // Padding to 32-bit boundary
        buf.extend_from_slice(&epb_total.to_le_bytes());

        fs::write(&temp_file, &buf).expect("Write PCAPNG test file");

        let (res, decoded) = ingest_pcap_file(&temp_file).expect("Ingest PCAPNG");
        assert_eq!(res.packets_processed, 1);
        assert_eq!(res.protocol_stats.udp_packets, 1);
        assert_eq!(res.protocol_stats.ipv4_packets, 1);
        assert_eq!(decoded.len(), 1);

        let _ = fs::remove_file(&temp_file);
    }

    #[test]
    fn test_rotating_writer_splits_segments() {
        let temp_dir = std::env::temp_dir().join(format!("openndr_rot_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        // Limite très basse de 100 octets par fichier pour déclencher une rotation réelle
        let mut writer = RotatingPcapWriter::new_with_bytes_limit(&temp_dir, 100, 1).expect("Init writer");

        let pkt = vec![0xffu8; 50]; // 16 + 50 = 66 octets par enregistrement (+24 global = 90)
        writer.write_packet(&pkt, 1000).expect("Write pkt 1");
        writer.write_packet(&pkt, 2000).expect("Write pkt 2"); // Doit déclencher une rotation
        drop(writer);

        let count = fs::read_dir(&temp_dir)
            .expect("Read dir")
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |x| x == "pcap"))
            .count();
        assert_eq!(count, 2, "Deux segments PCAP distincts doivent exister après rotation");
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
