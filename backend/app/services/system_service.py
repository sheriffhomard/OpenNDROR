"""
Service de supervision système, réseau, stockage et services systemd pour OpenNDR V0.1.
Toutes les mesures sont issues d'interrogations réelles du système d'exploitation Debian.
Zéro simulation, zéro fausse adresse MAC, zéro PID aléatoire.
"""
import os
import re
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.core.config import settings


class SystemService:
    # Liste blanche des services autorisés à être supervisés
    ALLOWED_SYSTEMD_UNITS = [
        "openndr-backend.service",
        "openndr-engine.service",
        "postgresql.service",
        "nginx.service",
        "openndr-web.service",
    ]

    @classmethod
    def get_real_network_interfaces(cls) -> List[Dict[str, Any]]:
        """
        Détecte et collecte les interfaces réseau réelles du système hôte Debian.
        Utilise les fichiers sous /sys/class/net et la commande 'ip' en lecture seule directe.
        """
        interfaces_dict: Dict[str, Dict[str, Any]] = {}

        # 1. Découverte via socket.if_nameindex() (standard POSIX)
        try:
            for idx, iface_name in socket.if_nameindex():
                interfaces_dict[iface_name] = {
                    "name": iface_name,
                    "index": idx,
                    "mac_address": "00:00:00:00:00:00",
                    "ipv4_addresses": [],
                    "ipv6_addresses": [],
                    "mtu": 1500,
                    "is_up": False,
                    "is_promiscuous": False,
                    "is_physical": False,
                    "operstate": "UNKNOWN",
                    "speed_mbps": None,
                    "role": "MONITOR",
                }
        except Exception:
            pass

        # 2. Collecte des propriétés via /sys/class/net si disponible (Linux sysfs)
        sysfs_net = "/sys/class/net"
        if os.path.exists(sysfs_net):
            try:
                for iface_name in os.listdir(sysfs_net):
                    if iface_name not in interfaces_dict:
                        interfaces_dict[iface_name] = {
                            "name": iface_name,
                            "index": len(interfaces_dict) + 1,
                            "mac_address": "00:00:00:00:00:00",
                            "ipv4_addresses": [],
                            "ipv6_addresses": [],
                            "mtu": 1500,
                            "is_up": False,
                            "is_promiscuous": False,
                            "is_physical": False,
                            "operstate": "UNKNOWN",
                            "speed_mbps": None,
                            "role": "MONITOR",
                        }

                    entry = interfaces_dict[iface_name]
                    iface_path = os.path.join(sysfs_net, iface_name)

                    # Adresse MAC réelle
                    addr_path = os.path.join(iface_path, "address")
                    if os.path.isfile(addr_path):
                        try:
                            with open(addr_path, "r") as f:
                                mac = f.read().strip()
                                if mac:
                                    entry["mac_address"] = mac
                        except Exception:
                            pass

                    # MTU réel
                    mtu_path = os.path.join(iface_path, "mtu")
                    if os.path.isfile(mtu_path):
                        try:
                            with open(mtu_path, "r") as f:
                                entry["mtu"] = int(f.read().strip())
                        except Exception:
                            pass

                    # État opérationnel réel
                    oper_path = os.path.join(iface_path, "operstate")
                    if os.path.isfile(oper_path):
                        try:
                            with open(oper_path, "r") as f:
                                state = f.read().strip().upper()
                                entry["operstate"] = state
                                entry["is_up"] = (state == "UP")
                        except Exception:
                            pass

                    # Flags (mode promiscuous : IFF_PROMISC = 0x100)
                    flags_path = os.path.join(iface_path, "flags")
                    if os.path.isfile(flags_path):
                        try:
                            with open(flags_path, "r") as f:
                                flags_val = int(f.read().strip(), 16)
                                entry["is_promiscuous"] = bool(flags_val & 0x100)
                                if flags_val & 0x1:
                                    entry["is_up"] = True
                        except Exception:
                            pass

                    # Vitesse (speed) si supportée
                    speed_path = os.path.join(iface_path, "speed")
                    if os.path.isfile(speed_path):
                        try:
                            with open(speed_path, "r") as f:
                                speed_val = int(f.read().strip())
                                if speed_val > 0:
                                    entry["speed_mbps"] = speed_val
                        except Exception:
                            pass

                    # Détection interface physique ou virtuelle
                    device_path = os.path.join(iface_path, "device")
                    entry["is_physical"] = os.path.exists(device_path)
            except Exception:
                pass

        # 3. Collecte des adresses IP et statuts via la commande 'ip' (sans shell)
        try:
            cmd_link = subprocess.run(
                ["ip", "-o", "link", "show"],
                capture_output=True,
                text=True,
                timeout=2,
                shell=False,
            )
            if cmd_link.returncode == 0:
                for line in cmd_link.stdout.splitlines():
                    match = re.search(r"^\d+:\s+([a-zA-Z0-9_\-\.]+):.*?<([^>]+)>.*?mtu\s+(\d+)", line)
                    if match:
                        name, flags_str, mtu_str = match.group(1), match.group(2), match.group(3)
                        if name not in interfaces_dict:
                            interfaces_dict[name] = {
                                "name": name,
                                "index": len(interfaces_dict) + 1,
                                "mac_address": "00:00:00:00:00:00",
                                "ipv4_addresses": [],
                                "ipv6_addresses": [],
                                "mtu": int(mtu_str),
                                "is_up": "UP" in flags_str,
                                "is_promiscuous": "PROMISC" in flags_str,
                                "is_physical": name not in ["lo", "docker0"] and not name.startswith("veth"),
                                "operstate": "UP" if "UP" in flags_str else "DOWN",
                                "speed_mbps": None,
                                "role": "MONITOR",
                            }
                        else:
                            entry = interfaces_dict[name]
                            entry["mtu"] = int(mtu_str)
                            if "PROMISC" in flags_str:
                                entry["is_promiscuous"] = True
                            if "UP" in flags_str:
                                entry["is_up"] = True
                                entry["operstate"] = "UP"

                    mac_match = re.search(r"link/(?:ether|none|loopback)\s+([0-9a-fA-F:]{17}|[0-9a-fA-F:]{12,})", line)
                    if match and mac_match:
                        name = match.group(1)
                        if name in interfaces_dict:
                            interfaces_dict[name]["mac_address"] = mac_match.group(1).lower()
        except Exception:
            pass

        # Collecte des adresses IP réelles (IPv4 et IPv6)
        try:
            cmd_addr = subprocess.run(
                ["ip", "-o", "addr", "show"],
                capture_output=True,
                text=True,
                timeout=2,
                shell=False,
            )
            if cmd_addr.returncode == 0:
                for line in cmd_addr.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 4:
                        iface_name = parts[1]
                        family = parts[2]
                        cidr = parts[3]
                        if iface_name in interfaces_dict:
                            if family == "inet":
                                interfaces_dict[iface_name]["ipv4_addresses"].append(cidr)
                            elif family == "inet6":
                                interfaces_dict[iface_name]["ipv6_addresses"].append(cidr)
        except Exception:
            pass

        # 4. Attribution des rôles stricts de l'architecture OpenNDROR
        results = []
        for iface_name, entry in interfaces_dict.items():
            if iface_name == settings.ADMIN_INTERFACE:
                entry["role"] = "ADMINISTRATION"
            elif iface_name == settings.CAPTURE_INTERFACE:
                entry["role"] = "CAPTURE_PASSIVE"
            else:
                entry["role"] = "LOOPBACK" if iface_name == "lo" else "MONITOR"

            # Formattage de l'IP principale pour compatibilité de schéma
            ip_repr = entry["ipv4_addresses"][0] if entry["ipv4_addresses"] else None
            entry["ip_address"] = ip_repr
            results.append(entry)

        return results

    @classmethod
    def check_interface_isolation(cls, capture_iface_name: str) -> Dict[str, Any]:
        """
        Vérification stricte de l'isolation de l'interface de capture passive.
        Exigences :
        - L'interface doit exister.
        - Aucune adresse IPv4 ou IPv6 ne doit y être configurée (Zéro émission).
        - Aucune route ni passerelle par défaut ne doit emprunter cette interface.
        - Elle doit être distincte de l'interface d'administration.
        """
        real_interfaces = {iface["name"]: iface for iface in cls.get_real_network_interfaces()}

        if capture_iface_name not in real_interfaces:
            return {
                "interface": capture_iface_name,
                "status": "NOT_CONFIGURED",
                "is_isolated": False,
                "has_ip": False,
                "has_routes": False,
                "is_promiscuous": False,
                "details": f"Passive capture interface '{capture_iface_name}' was not found on the system.",
            }

        iface_data = real_interfaces[capture_iface_name]
        has_ipv4 = len(iface_data.get("ipv4_addresses", [])) > 0
        has_ipv6 = len(iface_data.get("ipv6_addresses", [])) > 0
        has_ip = has_ipv4 or has_ipv6
        is_promisc = iface_data.get("is_promiscuous", False)

        # Check associated routes in /proc/net/route
        has_routes = False
        try:
            if os.path.exists("/proc/net/route"):
                with open("/proc/net/route", "r") as f:
                    for line in f.readlines()[1:]:
                        fields = line.strip().split()
                        if fields and fields[0] == capture_iface_name:
                            has_routes = True
                            break
        except Exception:
            pass

        # Conflict if admin == capture
        if capture_iface_name == settings.ADMIN_INTERFACE:
            return {
                "interface": capture_iface_name,
                "status": "CONFIG_CONFLICT",
                "is_isolated": False,
                "has_ip": has_ip,
                "has_routes": has_routes,
                "is_promiscuous": is_promisc,
                "details": "Management interface and capture interface are identical. Security conflict.",
            }

        if has_ip:
            ips = ", ".join(iface_data.get("ipv4_addresses", []) + iface_data.get("ipv6_addresses", []))
            return {
                "interface": capture_iface_name,
                "status": "ISOLATION_BREACHED",
                "is_isolated": False,
                "has_ip": True,
                "has_routes": has_routes,
                "is_promiscuous": is_promisc,
                "details": f"Stealth isolation violation: interface has configured IP addresses ({ips}).",
            }

        if has_routes:
            return {
                "interface": capture_iface_name,
                "status": "ROUTING_BREACHED",
                "is_isolated": False,
                "has_ip": False,
                "has_routes": True,
                "is_promiscuous": is_promisc,
                "details": "Isolation violation: system network routes traverse the passive interface.",
            }

        return {
            "interface": capture_iface_name,
            "status": "CONFORME_ISOLATED",
            "is_isolated": True,
            "has_ip": False,
            "has_routes": False,
            "is_promiscuous": is_promisc,
            "details": "Isolation compliance verified: stealth mode active, no IP address or route assigned.",
        }

    @classmethod
    def get_systemd_services_status(cls) -> List[Dict[str, Any]]:
        """
        Supervision réelle des unités systemd via 'systemctl show' direct sans shell.
        Retourne l'état précis (ACTIVE, INACTIVE, FAILED, NOT_FOUND, UNKNOWN) sans aucune simulation.
        """
        results = []
        now_iso = datetime.now(timezone.utc).isoformat()

        # Vérification préalable de la présence de systemctl
        has_systemctl = shutil.which("systemctl") is not None

        for unit in cls.ALLOWED_SYSTEMD_UNITS:
            unit_info = {
                "name": unit.replace(".service", ""),
                "unit": unit,
                "status": "UNKNOWN",
                "active_state": "unknown",
                "sub_state": "unknown",
                "load_state": "unknown",
                "main_pid": None,
                "exit_code": None,
                "last_checked_at": now_iso,
                "description": "",
            }

            if not has_systemctl:
                unit_info["status"] = "UNKNOWN"
                unit_info["description"] = "systemctl unavailable in this runtime environment"
                results.append(unit_info)
                continue

            try:
                cmd = subprocess.run(
                    [
                        "systemctl",
                        "show",
                        unit,
                        "--property=ActiveState,SubState,LoadState,MainPID,ExecMainStatus,ActiveEnterTimestamp,Description",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=3,
                    shell=False,
                )

                if cmd.returncode != 0:
                    unit_info["status"] = "UNKNOWN"
                    unit_info["description"] = "systemctl query failed"
                    results.append(unit_info)
                    continue

                props: Dict[str, str] = {}
                for line in cmd.stdout.splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        props[k.strip()] = v.strip()

                load_state = props.get("LoadState", "unknown").lower()
                active_state = props.get("ActiveState", "unknown").lower()
                sub_state = props.get("SubState", "unknown").lower()
                desc = props.get("Description", "")
                main_pid_str = props.get("MainPID", "0")
                exit_code_str = props.get("ExecMainStatus", "0")

                unit_info["load_state"] = load_state
                unit_info["active_state"] = active_state
                unit_info["sub_state"] = sub_state
                unit_info["description"] = desc

                try:
                    pid = int(main_pid_str)
                    unit_info["main_pid"] = pid if pid > 0 else None
                except ValueError:
                    unit_info["main_pid"] = None

                try:
                    unit_info["exit_code"] = int(exit_code_str)
                except ValueError:
                    unit_info["exit_code"] = None

                if load_state == "not-found":
                    unit_info["status"] = "NOT_FOUND"
                elif active_state == "active":
                    unit_info["status"] = "ACTIVE"
                elif active_state == "failed":
                    unit_info["status"] = "FAILED"
                elif active_state in ["inactive", "deactivating"]:
                    unit_info["status"] = "INACTIVE"
                else:
                    unit_info["status"] = "UNKNOWN"

            except subprocess.TimeoutExpired:
                unit_info["status"] = "UNKNOWN"
                unit_info["description"] = "systemctl call timed out"
            except Exception as e:
                unit_info["status"] = "UNKNOWN"
                unit_info["description"] = f"Monitoring error: {e}"

            results.append(unit_info)

        return results

    @classmethod
    def get_real_storage_metrics(cls) -> Dict[str, Any]:
        """
        Real storage metrics strictly separating overall disk usage
        from the dedicated PCAP directory (/var/lib/openndr/captures).
        Protected against directory traversal ('..').
        """
        pcap_raw = settings.PCAP_STORAGE_PATH

        # Security: strict path validation and normalization
        norm_path = os.path.normpath(pcap_raw)
        if ".." in norm_path.split(os.sep):
            raise ValueError("Unauthorized directory traversal attempt in PCAP path.")

        real_pcap_dir = os.path.realpath(norm_path)

        # 1. Mesures réelles du système de fichiers hôte
        mount_point = "/"
        if os.path.exists(real_pcap_dir):
            mount_point = real_pcap_dir

        try:
            disk_stat = shutil.disk_usage(mount_point)
            total_disk_gb = round(disk_stat.total / (1024 ** 3), 2)
            used_disk_gb = round(disk_stat.used / (1024 ** 3), 2)
            free_disk_gb = round(disk_stat.free / (1024 ** 3), 2)
            disk_usage_pct = round((disk_stat.used / disk_stat.total) * 100, 1) if disk_stat.total > 0 else 0.0
        except Exception:
            total_disk_gb = 0.0
            used_disk_gb = 0.0
            free_disk_gb = 0.0
            disk_usage_pct = 0.0

        # 2. Mesure dédiée du répertoire PCAP (sans confusion avec le disque total)
        pcap_used_bytes = 0
        pcap_file_count = 0
        pcap_dir_status = "READY"

        if not os.path.exists(real_pcap_dir):
            pcap_dir_status = "NOT_CREATED"
        elif not os.path.isdir(real_pcap_dir):
            pcap_dir_status = "NOT_A_DIRECTORY"
        else:
            try:
                # Parcours sans suivre les liens symboliques pour éviter toute évasion
                for root, _, files in os.walk(real_pcap_dir, followlinks=False):
                    for filename in files:
                        filepath = os.path.join(root, filename)
                        try:
                            st = os.lstat(filepath)
                            if not os.path.islink(filepath):
                                pcap_used_bytes += st.st_size
                                pcap_file_count += 1
                        except OSError:
                            pass
            except PermissionError:
                pcap_dir_status = "PERMISSION_DENIED"
            except Exception as e:
                pcap_dir_status = f"ERROR: {e}"

        pcap_used_gb = round(pcap_used_bytes / (1024 ** 3), 4)
        max_quota_gb = float(settings.MAX_PCAP_STORAGE_GB)
        remaining_quota_gb = max(0.0, round(max_quota_gb - pcap_used_gb, 4))
        quota_used_pct = round((pcap_used_gb / max_quota_gb) * 100, 2) if max_quota_gb > 0 else 0.0

        return {
            "filesystem": {
                "mount_point": mount_point,
                "total_gb": total_disk_gb,
                "used_gb": used_disk_gb,
                "free_gb": free_disk_gb,
                "used_pct": disk_usage_pct,
            },
            "pcap_storage": {
                "directory": real_pcap_dir,
                "status": pcap_dir_status,
                "used_bytes": pcap_used_bytes,
                "used_gb": pcap_used_gb,
                "file_count": pcap_file_count,
                "quota_gb": max_quota_gb,
                "remaining_quota_gb": remaining_quota_gb,
                "quota_used_pct": quota_used_pct,
                "retention_days": settings.PCAP_RETENTION_DAYS,
            },
            # Champs de compatibilité ascendante avec le frontend
            "pcapDirectory": real_pcap_dir,
            "maxStorageGb": max_quota_gb,
            "usedStorageGb": pcap_used_gb,
            "usedStoragePercent": quota_used_pct,
            "retentionDays": settings.PCAP_RETENTION_DAYS,
            "pcapFilesCount": pcap_file_count,
        }

    @classmethod
    def send_engine_ipc_command(cls, command: str) -> Dict[str, Any]:
        """
        Envoie une commande au moteur Rust OpenNDR via le socket IPC UNIX.
        """
        import json

        socket_path = settings.ENGINE_SOCKET_PATH
        if not os.path.exists(socket_path):
            return {
                "engine_version": "0.2.0",
                "is_running": False,
                "capture_mode": "STANDBY",
                "active_interface": None,
                "packets_received": 0,
                "packets_dropped": 0,
                "bytes_processed": 0,
                "current_mbps": 0.0,
                "ring_buffer_usage_pct": 0.0,
                "protocol_stats": {
                    "tcp_packets": 0,
                    "udp_packets": 0,
                    "icmp_packets": 0,
                    "arp_packets": 0,
                    "ipv4_packets": 0,
                    "ipv6_packets": 0,
                    "vlan_packets": 0,
                    "other_packets": 0,
                },
                "last_capture_file": None,
                "recent_packets": [],
                "socket_error": f"IPC socket {socket_path} unavailable (engine stopped)",
            }

        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.settimeout(5.0)
                client.connect(socket_path)
                client.sendall(command.encode("utf-8"))
                response_data = b""
                while True:
                    chunk = client.recv(65536)
                    if not chunk:
                        break
                    response_data += chunk
                return json.loads(response_data.decode("utf-8"))
        except Exception as e:
            return {
                "engine_version": "0.2.0",
                "is_running": False,
                "capture_mode": "STANDBY",
                "recent_packets": [],
                "error": str(e),
            }

    @classmethod
    def _find_engine_binary(cls) -> Optional[str]:
        bin_paths = [
            "/usr/local/bin/openndr-engine",
            "/usr/bin/openndr-engine",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../engine/target/release/openndr-engine")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../engine/target/debug/openndr-engine")),
        ]
        for b in bin_paths:
            if os.path.isfile(b) and os.access(b, os.X_OK):
                return b
        return None

    @classmethod
    def ingest_pcap_file(cls, filepath: str) -> Dict[str, Any]:
        """
        Ingests and decodes a PCAP or PCAPNG trace via the IPC daemon (if running) or openndr-engine binary.
        """
        import json

        if not filepath or not isinstance(filepath, str):
            raise ValueError("Invalid PCAP file path.")

        norm_path = os.path.normpath(filepath.strip())
        if ".." in norm_path.split(os.sep):
            raise ValueError("Directory traversal forbidden in PCAP path.")

        real_path = os.path.realpath(norm_path)
        if not os.path.isfile(real_path):
            raise FileNotFoundError(f"Trace file not found: {filepath}")

        ext = os.path.splitext(real_path)[1].lower()
        if ext not in {".pcap", ".pcapng", ".cap"}:
            raise ValueError("Unsupported file extension (expected .pcap, .pcapng, or .cap).")

        # Prefer active daemon IPC to update in-memory telemetry
        if os.path.exists(settings.ENGINE_SOCKET_PATH):
            ipc_res = cls.send_engine_ipc_command(f"INGEST_PCAP {real_path}")
            if isinstance(ipc_res, dict) and "packets_processed" in ipc_res:
                return ipc_res

        chosen_bin = cls._find_engine_binary()
        if not chosen_bin:
            raise RuntimeError("openndr-engine binary not found for PCAP analysis")

        proc = subprocess.run(
            [chosen_bin, "--ingest", real_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
            shell=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"openndr-engine ingestion error: {proc.stderr}")

        raw_stdout = proc.stdout.strip()
        json_start = raw_stdout.find("{")
        if json_start != -1:
            json_str = raw_stdout[json_start:]
            return json.loads(json_str)
        raise RuntimeError(f"Unexpected engine output: {raw_stdout}")

    @classmethod
    def ingest_pcap_bytes(cls, filename: str, raw_bytes: bytes) -> Dict[str, Any]:
        """
        Ingests a PCAP/PCAPNG trace uploaded by the browser using a secure temporary file.
        """
        import tempfile

        if not raw_bytes:
            raise ValueError("Empty PCAP file.")
        if len(raw_bytes) > 64 * 1024 * 1024:
            raise ValueError("Maximum trace size exceeded (64 MB max).")

        safe_name = os.path.basename(filename or "upload.pcap")
        ext = os.path.splitext(safe_name)[1].lower()
        if ext not in {".pcap", ".pcapng", ".cap"}:
            raise ValueError("Invalid format: only .pcap, .pcapng, and .cap files are accepted.")

        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(prefix="openndr_upload_", suffix=ext, delete=False) as tmp:
                tmp.write(raw_bytes)
                tmp_path = tmp.name

            result = cls.ingest_pcap_file(tmp_path)
            result["file_path"] = safe_name
            return result
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

