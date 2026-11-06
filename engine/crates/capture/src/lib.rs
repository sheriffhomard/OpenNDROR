//! OpenNDR Network Capture Engine (V0.1 Skeleton & Interface Contract)
//!
//! En V0.1, ce module garantit la préparation du ring buffer, la sélection d'interface
//! et la validation des invariants de sécurité avant capture (absence d'IP).

use openndr_common::{validate_capture_interface_isolation, EngineTelemetry, OpenNdrError};
use std::net::IpAddr;

pub struct CaptureConfig {
    pub interface_name: String,
    pub buffer_size_mb: usize,
    pub pcap_dump_path: Option<String>,
}

pub struct CaptureEngine {
    config: CaptureConfig,
    is_running: bool,
    packets_received: u64,
    packets_dropped: u64,
}

impl CaptureEngine {
    pub fn new(config: CaptureConfig) -> Self {
        Self {
            config,
            is_running: false,
            packets_received: 0,
            packets_dropped: 0,
        }
    }

    /// Démarre la capture après vérification d'isolation stricte
    pub fn start(&mut self, ip_check: Option<IpAddr>, is_promisc: bool) -> Result<(), OpenNdrError> {
        // Règle fondamentale : vérifier que l'interface ne fuit pas d'adresse IP
        validate_capture_interface_isolation(&self.config.interface_name, ip_check, is_promisc)?;
        self.is_running = true;
        Ok(())
    }

    pub fn stop(&mut self) {
        self.is_running = false;
    }

    pub fn get_telemetry(&self) -> EngineTelemetry {
        EngineTelemetry {
            engine_version: "0.1.0".to_string(),
            is_running: self.is_running,
            active_interface: if self.is_running {
                Some(self.config.interface_name.clone())
            } else {
                None
            },
            packets_received: self.packets_received,
            packets_dropped: self.packets_dropped,
            bytes_processed: self.packets_received * 512,
            current_mbps: if self.is_running { 0.0 } else { 0.0 },
            ring_buffer_usage_pct: 0.0,
        }
    }
}
