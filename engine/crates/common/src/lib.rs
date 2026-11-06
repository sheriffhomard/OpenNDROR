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
}

/// Mode de fonctionnement d'une interface réseau
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterfaceMode {
    /// Interface d'administration SOC (avec IP, accès Web/API)
    Administration,
    /// Interface de capture passive (SPAN/Mirror, promisc strict, SANS IP)
    PassiveCapture,
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

/// Télémétrie d'état du moteur de capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineTelemetry {
    pub engine_version: String,
    pub is_running: bool,
    pub active_interface: Option<String>,
    pub packets_received: u64,
    pub packets_dropped: u64,
    pub bytes_processed: u64,
    pub current_mbps: f64,
    pub ring_buffer_usage_pct: f32,
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
