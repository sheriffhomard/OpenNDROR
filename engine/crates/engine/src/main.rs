//! OpenNDR Network Detection & Response Engine (Rust - V0.2)
//!
//! Démon système `openndr-engine` V0.2 assurant :
//! - La capture réseau passive Linux via AF_PACKET
//! - Le décodage protocolaire hiérarchique L2 à L4
//! - L'ingestion et l'analyse de fichiers PCAP/PCAPNG
//! - L'écriture de captures rotatives avec respect des quotas
//! - Le dialogue IPC via le socket UNIX `/run/openndr/engine.sock`

use openndr_capture::{CaptureConfig, CaptureEngine};
use openndr_common::validate_capture_interface_isolation;
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
    let mut ingest_pcap_path: Option<String> = None;

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
            "--ingest" => {
                if i + 1 < args.len() {
                    ingest_pcap_path = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--version" | "-v" => {
                println!("openndr-engine 0.2.0 (Debian 13 target)");
                return Ok(());
            }
            "--help" | "-h" => {
                println!("Usage: openndr-engine [--config <path>] [--check-config] [--ingest <file.pcap>] [--version]");
                return Ok(());
            }
            _ => {}
        }
        i += 1;
    }

    info!("OpenNDR Network Detection Engine v0.2.0 démarré");
    info!("Chargement de la configuration depuis {}", config_path);
    let cfg = load_config(&config_path)?;

    // Mode Ingestion CLI directe (ex: openndr-engine --ingest /path/to/trace.pcap)
    if let Some(pcap_path) = ingest_pcap_path {
        println!("[*] Analyse et décodage du fichier trace : {}", pcap_path);
        let capture_cfg = CaptureConfig {
            interface_name: cfg.network.capture_interface.clone(),
            buffer_size_mb: cfg.network.capture_buffer_size_mb.unwrap_or(256),
            pcap_dump_dir: Some(cfg.storage.pcap_dir.clone()),
            max_storage_gb: cfg.storage.max_storage_gb.unwrap_or(500) as u64,
            promisc_mode: cfg.network.promiscuous_mode.unwrap_or(true),
        };
        let engine = CaptureEngine::new(capture_cfg);
        match engine.ingest_file(&pcap_path) {
            Ok(report) => {
                println!("{}", serde_json::to_string_pretty(&report)?);
                return Ok(());
            }
            Err(e) => {
                eprintln!("[!] Échec d'ingestion PCAP : {}", e);
                std::process::exit(1);
            }
        }
    }

    // Validation des invariants d'isolation réseau V0.1/V0.2 (ADR-003)
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
        return Err(e.into());
    }
    info!("Conformité d'isolation réseau validée : mode furtif actif.");

    if check_only {
        println!("[✓] Configuration et invariants V0.2 validés avec succès.");
        return Ok(());
    }

    // Initialisation du moteur de capture V0.2
    let capture_cfg = CaptureConfig {
        interface_name: cfg.network.capture_interface.clone(),
        buffer_size_mb: cfg.network.capture_buffer_size_mb.unwrap_or(256),
        pcap_dump_dir: Some(cfg.storage.pcap_dir.clone()),
        max_storage_gb: cfg.storage.max_storage_gb.unwrap_or(500) as u64,
        promisc_mode: is_promisc,
    };
    let engine = Arc::new(tokio::sync::Mutex::new(CaptureEngine::new(capture_cfg)));

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
    let engine_shutdown_ref = engine.clone();
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
        let mut eng = engine_shutdown_ref.lock().await;
        eng.stop();
        let _ = fs::remove_file(&cleanup_path);
    });

    info!("Moteur OpenNDR V0.2 prêt et à l'écoute des requêtes IPC...");

    // Boucle d'écoute IPC
    while is_running.load(Ordering::SeqCst) {
        tokio::select! {
            accept_res = listener.accept() => {
                match accept_res {
                    Ok((mut stream, _)) => {
                        let mut buf = [0u8; 4096];
                        if let Ok(n) = stream.read(&mut buf).await {
                            let req = String::from_utf8_lossy(&buf[..n]);
                            let trimmed = req.trim();

                            if trimmed == "GET_STATUS" || trimmed == "GET_TELEMETRY" {
                                let eng = engine.lock().await;
                                let telemetry = eng.get_telemetry();
                                let json = serde_json::to_vec(&telemetry).unwrap_or_default();
                                let _ = stream.write_all(&json).await;
                            } else if trimmed.starts_with("START_CAPTURE") {
                                let iface_arg = trimmed
                                    .strip_prefix("START_CAPTURE")
                                    .map(|s| s.trim())
                                    .filter(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.'));
                                let target_iface = iface_arg.unwrap_or(&cfg.network.capture_interface).to_string();
                                let mut eng = engine.lock().await;
                                match eng.start_on_interface(&target_iface, None, is_promisc) {
                                    Ok(()) => {
                                        let resp = serde_json::json!({
                                            "status": "OK",
                                            "message": format!("Capture AF_PACKET active sur {}", target_iface)
                                        });
                                        let _ = stream.write_all(resp.to_string().as_bytes()).await;
                                    }
                                    Err(e) => {
                                        let resp = serde_json::json!({
                                            "status": "ERROR",
                                            "message": e.to_string()
                                        });
                                        let _ = stream.write_all(resp.to_string().as_bytes()).await;
                                    }
                                }
                            } else if trimmed == "STOP_CAPTURE" {
                                let mut eng = engine.lock().await;
                                eng.stop();
                                let _ = stream.write_all(b"{\"status\":\"OK\",\"message\":\"Capture stoppee\"}").await;
                            } else if trimmed.starts_with("INGEST_PCAP ") {
                                let pcap_file = trimmed.trim_start_matches("INGEST_PCAP ").trim();
                                let eng = engine.lock().await;
                                match eng.ingest_file(pcap_file) {
                                    Ok(report) => {
                                        let json = serde_json::to_vec(&report).unwrap_or_default();
                                        let _ = stream.write_all(&json).await;
                                    }
                                    Err(e) => {
                                        let resp = serde_json::json!({
                                            "status": "ERROR",
                                            "message": e.to_string()
                                        });
                                        let _ = stream.write_all(resp.to_string().as_bytes()).await;
                                    }
                                }
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
    info!("Moteur OpenNDR V0.2 arrêté avec succès.");
    Ok(())
}
