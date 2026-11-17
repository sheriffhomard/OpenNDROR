//! OpenNDR Common Types and IPC Contracts (V0.1)
//!
//! Ce module définit les contrats d'interface stricts et types partagés
//! entre le moteur de capture réseau Rust et le backend FastAPI.

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum OpenNdrError {
    #[error("Interface de capture invalide : {0}")]
    InvalidInterface(String),

    #[error("Violations d'isolation : l'interface de capture {0} a une adresse IP assignée ({1})")]
    CaptureInterfaceHasIp(String, String),

    #[error("Erreur de buffer de capture : {0}")]
    BufferOverflow(String),

    #[error("Erreur de décodage paquet (non fatal) : {0}")]
    DecodeError(String),

    #[error("Erreur PCAP : {0}")]
    PcapError(String),
}

/// Mode de fonctionnement d'une interface réseau
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterfaceMode {
    /// Interface d'administration SOC (avec IP, accès Web/API)
    Administration,
    /// Interface de capture passive (SPAN/Mirror, promisc strict, SANS IP)
    PassiveCapture,
}

/// Statistiques de protocoles réseau (L2 à L4)
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProtocolStats {
    pub tcp_packets: u64,
    pub udp_packets: u64,
    pub icmp_packets: u64,
    pub arp_packets: u64,
    pub ipv4_packets: u64,
    pub ipv6_packets: u64,
    pub vlan_packets: u64,
    pub other_packets: u64,
}

/// Validation de l'isolation réseau d'une interface de capture
pub fn validate_capture_interface_isolation(
    iface_name: &str,
    ip_address: Option<IpAddr>,
    is_promisc: bool,
) -> Result<(), OpenNdrError> {
    if let Some(ip) = ip_address {
        return Err(OpenNdrError::CaptureInterfaceHasIp(
            iface_name.to_string(),
            ip.to_string(),
        ));
    }
    if !is_promisc {
        return Err(OpenNdrError::InvalidInterface(format!(
            "L'interface {} doit être en mode promiscuous pour la capture",
            iface_name
        )));
    }
    Ok(())
}

/// Résumé structuré d'un paquet décodé L2-L4 (V0.2)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PacketSummary {
    pub timestamp_us: u64,
    pub raw_len: usize,
    pub protocol: String,
    pub vlan_id: Option<u16>,
    pub src_mac: String,
    pub dst_mac: String,
    pub src_ip: Option<String>,
    pub dst_ip: Option<String>,
    pub src_port: Option<u16>,
    pub dst_port: Option<u16>,
    pub tcp_flags: Option<String>,
    pub info: String,
}

/// Résultat d'ingestion d'un fichier PCAP / PCAPNG
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PcapIngestionResult {
    pub file_path: String,
    pub file_size_bytes: u64,
    pub packets_processed: u64,
    pub bytes_processed: u64,
    pub duration_seconds: f64,
    pub protocol_stats: ProtocolStats,
    pub first_packet_timestamp: Option<u64>,
    pub last_packet_timestamp: Option<u64>,
    pub packet_summaries: Vec<PacketSummary>,
}

/// Télémétrie d'état du moteur de capture V0.2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineTelemetry {
    pub engine_version: String,
    pub is_running: bool,
    pub capture_mode: String,
    pub active_interface: Option<String>,
    pub packets_received: u64,
    pub packets_dropped: u64,
    pub bytes_processed: u64,
    pub current_mbps: f64,
    pub ring_buffer_usage_pct: f32,
    pub protocol_stats: ProtocolStats,
    pub last_capture_file: Option<String>,
    pub recent_packets: Vec<PacketSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn test_valid_passive_interface() {
        let res = validate_capture_interface_isolation("eth1", None, true);
        assert!(res.is_ok());
    }

    #[test]
    fn test_rejects_capture_with_ip() {
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100));
        let res = validate_capture_interface_isolation("eth1", Some(ip), true);
        assert!(matches!(res, Err(OpenNdrError::CaptureInterfaceHasIp(_, _))));
    }

    #[test]
    fn test_rejects_non_promisc_interface() {
        let res = validate_capture_interface_isolation("eth1", None, false);
        assert!(matches!(res, Err(OpenNdrError::InvalidInterface(_))));
    }
}
