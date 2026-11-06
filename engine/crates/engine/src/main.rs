//! OpenNDR Network Detection & Response Engine (Rust)
//!
//! Point d'entrée principal du démon système `openndr-engine`.
//! En V0.1, le démon valide la configuration, vérifie l'invariance d'isolation
//! de l'interface de capture, écoute sur le socket IPC `/run/openndr/engine.sock`
//! et gère proprement les signaux d'arrêt SIGINT/SIGTERM.

use openndr_capture::{CaptureConfig, CaptureEngine};
use openndr_common::{validate_capture_interface_isolation, EngineTelemetry, OpenNdrError};
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixListener;
use tokio::signal;
use tracing::{error, info, warn};

#[derive(Debug, Deserialize, Clone)]
pub struct EngineConfigFile {
    pub network: NetworkConfig,
    pub engine: EngineConfig,
    pub storage: StorageConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NetworkConfig {
    pub admin_interface: String,
    pub capture_interface: String,
    pub capture_buffer_size_mb: Option<usize>,
    pub promiscuous_mode: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct EngineConfig {
    pub ipc_socket_path: String,
    pub log_level: Option<String>,
    pub worker_threads: Option<usize>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct StorageConfig {
    pub pcap_dir: String,
    pub max_storage_gb: Option<usize>,
    pub retention_days: Option<usize>,
}

impl Default for EngineConfigFile {
    fn default() -> Self {
        Self {
            network: NetworkConfig {
                admin_interface: "eth0".to_string(),
                capture_interface: "eth1".to_string(),
                capture_buffer_size_mb: Some(256),
                promiscuous_mode: Some(true),
            },
            engine: EngineConfig {
                ipc_socket_path: "/run/openndr/engine.sock".to_string(),
                log_level: Some("info".to_string()),
                worker_threads: Some(4),
            },
            storage: StorageConfig {
                pcap_dir: "/var/lib/openndr/captures".to_string(),
                max_storage_gb: Some(500),
                retention_days: Some(30),
            },
        }
    }
}

fn load_config(path: &str) -> Result<EngineConfigFile, Box<dyn std::error::Error>> {
    let mut config = EngineConfigFile::default();
    if Path::new(path).exists() {
        let content = fs::read_to_string(path)?;
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with('#') || line.starts_with('[') || line.is_empty() {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let key = k.trim();
                let val = v.trim().trim_matches('"');
                match key {
                    "admin_interface" => config.network.admin_interface = val.to_string(),
                    "capture_interface" => config.network.capture_interface = val.to_string(),
                    "ipc_socket_path" => config.engine.ipc_socket_path = val.to_string(),
                    "pcap_dir" => config.storage.pcap_dir = val.to_string(),
                    _ => {}
                }
            }
        }
    } else {
        warn!(
            "Fichier de configuration {} introuvable, utilisation des paramètres par défaut",
            path
        );
    }
    Ok(config)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let args: Vec<String> = env::args().collect();
    let mut config_path = "/etc/openndr/openndr.conf".to_string();
    let mut check_only = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--config" | "-c" => {
                if i + 1 < args.len() {
                    config_path = args[i + 1].clone();
                    i += 1;
                }
            }
            "--check-config" => {
                check_only = true;
            }
            "--version" | "-v" => {
                println!("openndr-engine 0.1.0 (Debian 13 target)");
                return Ok(());
            }
            "--help" | "-h" => {
                println!("Usage: openndr-engine [--config <path>] [--check-config] [--version]");
                return Ok(());
            }
            _ => {}
        }
        i += 1;
    }

    info!("OpenNDR Network Engine v0.1.0 démarré");
    info!("Chargement de la configuration depuis {}", config_path);
    let cfg = load_config(&config_path)?;

    // Validation des invariants d'isolation réseau V0.1 (ADR-003)
    info!(
        "Validation de l'interface de capture passive : {}",
        cfg.network.capture_interface
    );
    let is_promisc = cfg.network.promiscuous_mode.unwrap_or(true);
    let validation_result = validate_capture_interface_isolation(
        &cfg.network.capture_interface,
        None, // Zéro IP exigée en capture passive
        is_promisc,
    );

    if let Err(e) = validation_result {
        error!("ÉCHEC DE VALIDATION DE SÉCURITÉ : {}", e);
        return Err(Box::new(e));
    }
    info!("Conformité d'isolation réseau validée : mode furtif actif.");

    if check_only {
        println!("[✓] Configuration et invariants validés avec succès.");
        return Ok(());
    }

    // Préparation de l'IPC Socket UNIX
    let socket_path = cfg.engine.ipc_socket_path.clone();
    if let Some(parent) = Path::new(&socket_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::remove_file(&socket_path);

    let listener = UnixListener::bind(&socket_path)?;
    info!("Socket IPC opérationnel sur {}", socket_path);

    let is_running = Arc::new(AtomicBool::new(true));
    let shutdown_signal = is_running.clone();

    // Tâche de gestion des signaux système SIGINT / SIGTERM
    let cleanup_path = socket_path.clone();
    tokio::spawn(async move {
        let mut sigterm = signal::unix::signal(signal::unix::SignalKind::terminate()).unwrap();
        tokio::select! {
            _ = signal::ctrl_c() => {
                info!("Signal SIGINT reçu, arrêt ordonné du moteur...");
            }
            _ = sigterm.recv() => {
                info!("Signal SIGTERM reçu (systemd stop), arrêt ordonné...");
            }
        }
        shutdown_signal.store(false, Ordering::SeqCst);
        let _ = fs::remove_file(&cleanup_path);
    });

    info!("Moteur OpenNDR en attente de requêtes IPC (V0.1 Standby)...");

    // Boucle d'écoute IPC
    while is_running.load(Ordering::SeqCst) {
        tokio::select! {
            accept_res = listener.accept() => {
                match accept_res {
                    Ok((mut stream, _)) => {
                        let mut buf = [0u8; 1024];
                        if let Ok(n) = stream.read(&mut buf).await {
                            let req = String::from_utf8_lossy(&buf[..n]);
                            if req.trim() == "GET_STATUS" {
                                let telemetry = EngineTelemetry {
                                    engine_version: "0.1.0".to_string(),
                                    is_running: true,
                                    active_interface: Some(cfg.network.capture_interface.clone()),
                                    packets_received: 0,
                                    packets_dropped: 0,
                                    bytes_processed: 0,
                                    current_mbps: 0.0,
                                    ring_buffer_usage_pct: 0.0,
                                };
                                let json = serde_json::to_vec(&telemetry).unwrap_or_default();
                                let _ = stream.write_all(&json).await;
                            } else {
                                let _ = stream.write_all(b"{\"status\":\"UNKNOWN_COMMAND\"}").await;
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                if !is_running.load(Ordering::SeqCst) {
                    break;
                }
            }
        }
    }

    let _ = fs::remove_file(&socket_path);
    info!("Moteur OpenNDR arrêté avec succès.");
    Ok(())
}
