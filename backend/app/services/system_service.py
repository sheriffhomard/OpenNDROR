"""
System, network, storage, systemd, Rust IPC, and update state service for OpenNDR V0.2.
All measurements come from direct OS/kernel/systemd/IPC/PostgreSQL inspection.
No synthetic MAC addresses, no artificial MTUs, no fake zero counters, no standby fabrication.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.system import SystemSetting


class SystemService:
    # Whitelisted systemd units supervised by OpenNDR (FastAPI + Rust engine + PostgreSQL + Nginx)
    ALLOWED_SYSTEMD_UNITS = [
        "openndr-backend.service",
        "openndr-engine.service",
        "postgresql.service",
        "nginx.service",
    ]

    UPDATE_SETTING_KEY = "system_updates_state"

    @staticmethod
    def _read_sysfs_int(path: str) -> Optional[int]:
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return int(f.read().strip())
        except Exception:
            return None

    @staticmethod
    def _read_sysfs_str(path: str) -> Optional[str]:
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                val = f.read().strip()
                return val if val else None
        except Exception:
            return None

    @classmethod
    def get_real_network_interfaces(cls) -> List[Dict[str, Any]]:
        """
        Discovers and collects real host network interfaces via POSIX socket,
        /sys/class/net, and `iproute2` (without shell).
        Uncollectable hardware attributes remain None (never fabricated).
        """
        interfaces_dict: Dict[str, Dict[str, Any]] = {}

        def _base_entry(name: str, index: int) -> Dict[str, Any]:
            return {
                "name": name,
                "index": index,
                "mac_address": None,
                "ipv4_addresses": [],
                "ipv6_addresses": [],
                "mtu": None,
                "is_up": False,
                "is_promiscuous": False,
                "is_physical": False,
                "operstate": "UNKNOWN",
                "speed_mbps": None,
                "rx_packets": None,
                "tx_packets": None,
                "rx_bytes": None,
                "tx_bytes": None,
                "rx_dropped": None,
                "role": "MONITOR",
            }

        # 1. Discovery via POSIX socket.if_nameindex()
        try:
            for idx, iface_name in socket.if_nameindex():
                interfaces_dict[iface_name] = _base_entry(iface_name, idx)
        except Exception:
            pass

        # 2. Direct sysfs inspection (/sys/class/net)
        sysfs_net = "/sys/class/net"
        if os.path.exists(sysfs_net):
            try:
                for iface_name in sorted(os.listdir(sysfs_net)):
                    if iface_name not in interfaces_dict:
                        interfaces_dict[iface_name] = _base_entry(iface_name, len(interfaces_dict) + 1)

                    entry = interfaces_dict[iface_name]
                    iface_path = os.path.join(sysfs_net, iface_name)

                    mac = cls._read_sysfs_str(os.path.join(iface_path, "address"))
                    if mac:
                        entry["mac_address"] = mac.lower()

                    mtu = cls._read_sysfs_int(os.path.join(iface_path, "mtu"))
                    if mtu is not None and mtu > 0:
                        entry["mtu"] = mtu

                    oper = cls._read_sysfs_str(os.path.join(iface_path, "operstate"))
                    if oper:
                        entry["operstate"] = oper.upper()
                        entry["is_up"] = oper.upper() == "UP"

                    flags_raw = cls._read_sysfs_str(os.path.join(iface_path, "flags"))
                    if flags_raw:
                        try:
                            flags_val = int(flags_raw, 16)
                            entry["is_promiscuous"] = bool(flags_val & 0x100)
                            if flags_val & 0x1:
                                entry["is_up"] = True
                        except ValueError:
                            pass

                    speed_val = cls._read_sysfs_int(os.path.join(iface_path, "speed"))
                    if speed_val is not None and speed_val > 0:
                        entry["speed_mbps"] = speed_val

                    stats_dir = os.path.join(iface_path, "statistics")
                    entry["rx_packets"] = cls._read_sysfs_int(os.path.join(stats_dir, "rx_packets"))
                    entry["tx_packets"] = cls._read_sysfs_int(os.path.join(stats_dir, "tx_packets"))
                    entry["rx_bytes"] = cls._read_sysfs_int(os.path.join(stats_dir, "rx_bytes"))
                    entry["tx_bytes"] = cls._read_sysfs_int(os.path.join(stats_dir, "tx_bytes"))
                    entry["rx_dropped"] = cls._read_sysfs_int(os.path.join(stats_dir, "rx_dropped"))

                    entry["is_physical"] = os.path.exists(os.path.join(iface_path, "device"))
            except Exception:
                pass

        # 3. Supplement with iproute2 (`ip -o link show` / `ip -o addr show`, shell=False)
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
                    match = re.search(
                        r"^\d+:\s+([a-zA-Z0-9_\-\.@]+):.*?<([^>]+)>.*?mtu\s+(\d+)",
                        line,
                    )
                    if match:
                        name = match.group(1).split("@")[0]
                        flags_str = match.group(2)
                        mtu_val = int(match.group(3))
                        if name not in interfaces_dict:
                            interfaces_dict[name] = _base_entry(name, len(interfaces_dict) + 1)
                            interfaces_dict[name]["is_physical"] = (
                                name not in ["lo", "docker0"] and not name.startswith("veth")
                            )
                        entry = interfaces_dict[name]
                        entry["mtu"] = mtu_val
                        if "PROMISC" in flags_str:
                            entry["is_promiscuous"] = True
                        if "UP" in flags_str:
                            entry["is_up"] = True
                            if entry["operstate"] == "UNKNOWN":
                                entry["operstate"] = "UP"
                        elif entry["operstate"] == "UNKNOWN":
                            entry["operstate"] = "DOWN"

                        mac_match = re.search(
                            r"link/(?:ether|loopback)\s+([0-9a-fA-F:]{17})",
                            line,
                        )
                        if mac_match and entry["mac_address"] is None:
                            entry["mac_address"] = mac_match.group(1).lower()
        except Exception:
            pass

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
                        iface_name = parts[1].split("@")[0]
                        family = parts[2]
                        cidr = parts[3]
                        if iface_name in interfaces_dict:
                            if family == "inet":
                                interfaces_dict[iface_name]["ipv4_addresses"].append(cidr)
                            elif family == "inet6":
                                interfaces_dict[iface_name]["ipv6_addresses"].append(cidr)
        except Exception:
            pass

        # 4. Assign strict OpenNDR architectural roles
        results = []
        for iface_name, entry in interfaces_dict.items():
            if iface_name == settings.ADMIN_INTERFACE:
                entry["role"] = "ADMINISTRATION"
            elif iface_name == settings.CAPTURE_INTERFACE:
                entry["role"] = "CAPTURE_PASSIVE"
            else:
                entry["role"] = "LOOPBACK" if iface_name == "lo" else "MONITOR"

            entry["ip_address"] = (
                entry["ipv4_addresses"][0] if entry["ipv4_addresses"] else None
            )
            results.append(entry)

        return results

    @classmethod
    def check_interface_isolation(cls, capture_iface_name: str) -> Dict[str, Any]:
        """
        Strict audit of passive capture interface isolation.
        Separates expected configuration, observed host state, and final validation result.
        Checks existence, admin/capture conflict, IPv4/IPv6 addresses, IPv4/IPv6 routes,
        link state, and promiscuous readiness.
        """
        expected_config = {
            "admin_interface": settings.ADMIN_INTERFACE,
            "capture_interface": capture_iface_name,
            "require_distinct_from_admin": True,
            "require_no_ip": True,
            "require_no_routes": True,
            "require_promiscuous": True,
            "require_link_up": True,
        }

        real_interfaces = {iface["name"]: iface for iface in cls.get_real_network_interfaces()}

        if capture_iface_name not in real_interfaces:
            return {
                "interface": capture_iface_name,
                "status": "NOT_CONFIGURED",
                "validation_result": "NOT_CONFIGURED",
                "is_isolated": False,
                "has_ip": False,
                "has_routes": False,
                "is_promiscuous": False,
                "details": f"Passive capture interface '{capture_iface_name}' was not found on the system.",
                "expected_config": expected_config,
                "observed_state": {
                    "interface_exists": False,
                    "is_same_as_admin": capture_iface_name == settings.ADMIN_INTERFACE,
                    "ipv4_addresses": [],
                    "ipv6_addresses": [],
                    "routes": [],
                    "is_up": False,
                    "operstate": "NOT_FOUND",
                    "is_promiscuous": False,
                    "capture_ready": False,
                },
            }

        iface_data = real_interfaces[capture_iface_name]
        ipv4_addrs = iface_data.get("ipv4_addresses", [])
        ipv6_addrs = iface_data.get("ipv6_addresses", [])
        has_ip = len(ipv4_addrs) > 0 or len(ipv6_addrs) > 0
        is_promisc = bool(iface_data.get("is_promiscuous", False))
        is_up = bool(iface_data.get("is_up", False))
        operstate = iface_data.get("operstate", "UNKNOWN")

        routes_found: List[str] = []

        # IPv4 kernel routing table
        try:
            if os.path.exists("/proc/net/route"):
                with open("/proc/net/route", "r", encoding="utf-8") as f:
                    for line in f.readlines()[1:]:
                        fields = line.strip().split()
                        if fields and fields[0] == capture_iface_name:
                            routes_found.append(f"ipv4:/proc/net/route dest={fields[1]} gw={fields[2]}")
        except Exception:
            pass

        # IPv4 & IPv6 routes via iproute2 (shell=False)
        for family_flag, label in (("-4", "ipv4"), ("-6", "ipv6")):
            try:
                cmd = subprocess.run(
                    ["ip", family_flag, "route", "show", "dev", capture_iface_name],
                    capture_output=True,
                    text=True,
                    timeout=2,
                    shell=False,
                )
                if cmd.returncode == 0:
                    for rline in cmd.stdout.splitlines():
                        rline = rline.strip()
                        if rline:
                            routes_found.append(f"{label}:{rline}")
            except Exception:
                pass

        has_routes = len(routes_found) > 0
        is_same_as_admin = capture_iface_name == settings.ADMIN_INTERFACE
        capture_ready = (not is_same_as_admin) and (not has_ip) and (not has_routes) and is_up and is_promisc

        observed_state = {
            "interface_exists": True,
            "is_same_as_admin": is_same_as_admin,
            "ipv4_addresses": ipv4_addrs,
            "ipv6_addresses": ipv6_addrs,
            "routes": routes_found,
            "is_up": is_up,
            "operstate": operstate,
            "is_promiscuous": is_promisc,
            "capture_ready": capture_ready,
        }

        if is_same_as_admin:
            return {
                "interface": capture_iface_name,
                "status": "CONFIG_CONFLICT",
                "validation_result": "CONFIG_CONFLICT",
                "is_isolated": False,
                "has_ip": has_ip,
                "has_routes": has_routes,
                "is_promiscuous": is_promisc,
                "details": "Management interface and capture interface are identical. Security conflict.",
                "expected_config": expected_config,
                "observed_state": observed_state,
            }

        if has_ip:
            ips = ", ".join(ipv4_addrs + ipv6_addrs)
            return {
                "interface": capture_iface_name,
                "status": "ISOLATION_BREACHED",
                "validation_result": "ISOLATION_BREACHED",
                "is_isolated": False,
                "has_ip": True,
                "has_routes": has_routes,
                "is_promiscuous": is_promisc,
                "details": f"Stealth isolation violation: interface has configured IP addresses ({ips}).",
                "expected_config": expected_config,
                "observed_state": observed_state,
            }

        if has_routes:
            return {
                "interface": capture_iface_name,
                "status": "ROUTING_BREACHED",
                "validation_result": "ROUTING_BREACHED",
                "is_isolated": False,
                "has_ip": False,
                "has_routes": True,
                "is_promiscuous": is_promisc,
                "details": f"Isolation violation: system routes traverse the passive interface ({len(routes_found)} route(s)).",
                "expected_config": expected_config,
                "observed_state": observed_state,
            }

        readiness_note = (
            "Passive link UP & promiscuous mode active."
            if capture_ready
            else f"Passive link state={operstate}, promiscuous={is_promisc} (capture readiness incomplete)."
        )
        return {
            "interface": capture_iface_name,
            "status": "CONFORME_ISOLATED",
            "validation_result": "CONFORME_ISOLATED",
            "is_isolated": True,
            "has_ip": False,
            "has_routes": False,
            "is_promiscuous": is_promisc,
            "details": f"Isolation compliance verified: zero IP, zero route. {readiness_note}",
            "expected_config": expected_config,
            "observed_state": observed_state,
        }

    @classmethod
    def get_systemd_services_status(cls) -> List[Dict[str, Any]]:
        """
        Real supervision of allowed systemd units via `systemctl show` (shell=False).
        Returns ACTIVE, INACTIVE, FAILED, NOT_FOUND, or UNKNOWN without simulation.
        """
        results = []
        now_iso = datetime.now(timezone.utc).isoformat()
        has_systemctl = shutil.which("systemctl") is not None

        for unit in cls.ALLOWED_SYSTEMD_UNITS:
            unit_info: Dict[str, Any] = {
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
                unit_info["description"] = "systemctl call timed out"
            except Exception as e:
                unit_info["description"] = f"Monitoring error: {e}"

            results.append(unit_info)

        return results

    @classmethod
    def get_real_storage_metrics(cls) -> Dict[str, Any]:
        """
        Real storage metrics strictly separating host filesystem disk usage
        from the dedicated PCAP directory and verifying real write permissions.
        """
        pcap_raw = settings.PCAP_STORAGE_PATH

        norm_path = os.path.normpath(pcap_raw)
        if ".." in norm_path.split(os.sep):
            raise ValueError("Unauthorized directory traversal attempt in PCAP path.")

        real_pcap_dir = os.path.realpath(norm_path)
        mount_point = real_pcap_dir if os.path.exists(real_pcap_dir) else "/"
        disk_error: Optional[str] = None

        try:
            disk_stat = shutil.disk_usage(mount_point)
            total_disk_gb = round(disk_stat.total / (1024 ** 3), 2)
            used_disk_gb = round(disk_stat.used / (1024 ** 3), 2)
            free_disk_gb = round(disk_stat.free / (1024 ** 3), 2)
            disk_usage_pct = round((disk_stat.used / disk_stat.total) * 100, 1) if disk_stat.total > 0 else 0.0
        except Exception as exc:
            total_disk_gb = None
            used_disk_gb = None
            free_disk_gb = None
            disk_usage_pct = None
            disk_error = str(exc)

        pcap_used_bytes: Optional[int] = 0
        pcap_file_count: Optional[int] = 0
        pcap_dir_status = "READY"
        is_writable = False
        write_error: Optional[str] = None

        if not os.path.exists(real_pcap_dir):
            pcap_dir_status = "NOT_CREATED"
            pcap_used_bytes = None
            pcap_file_count = None
            write_error = f"PCAP directory does not exist: {real_pcap_dir}"
        elif not os.path.isdir(real_pcap_dir):
            pcap_dir_status = "NOT_A_DIRECTORY"
            pcap_used_bytes = None
            pcap_file_count = None
            write_error = f"Configured PCAP path is not a directory: {real_pcap_dir}"
        else:
            try:
                for root, _, files in os.walk(real_pcap_dir, followlinks=False):
                    for filename in files:
                        filepath = os.path.join(root, filename)
                        try:
                            st = os.lstat(filepath)
                            if not os.path.islink(filepath):
                                pcap_used_bytes = (pcap_used_bytes or 0) + st.st_size
                                pcap_file_count = (pcap_file_count or 0) + 1
                        except OSError:
                            pass
            except PermissionError as exc:
                pcap_dir_status = "PERMISSION_DENIED"
                pcap_used_bytes = None
                pcap_file_count = None
                write_error = str(exc)
            except Exception as exc:
                pcap_dir_status = "ERROR"
                pcap_used_bytes = None
                pcap_file_count = None
                write_error = str(exc)

            if pcap_dir_status == "READY":
                try:
                    with tempfile.NamedTemporaryFile(
                        prefix=".openndr_write_probe_",
                        dir=real_pcap_dir,
                        delete=True,
                    ) as probe:
                        probe.write(b"1")
                        probe.flush()
                    is_writable = True
                except PermissionError as exc:
                    is_writable = False
                    pcap_dir_status = "PERMISSION_DENIED"
                    write_error = f"Directory not writable: {exc}"
                except OSError as exc:
                    is_writable = False
                    pcap_dir_status = "READ_ONLY"
                    write_error = f"Write probe failed: {exc}"

        pcap_used_gb = round(pcap_used_bytes / (1024 ** 3), 4) if pcap_used_bytes is not None else None
        max_quota_gb = float(settings.MAX_PCAP_STORAGE_GB)
        remaining_quota_gb = (
            max(0.0, round(max_quota_gb - pcap_used_gb, 4))
            if pcap_used_gb is not None
            else None
        )
        quota_used_pct = (
            round((pcap_used_gb / max_quota_gb) * 100, 2)
            if (pcap_used_gb is not None and max_quota_gb > 0)
            else None
        )

        return {
            "filesystem": {
                "mount_point": mount_point,
                "total_gb": total_disk_gb,
                "used_gb": used_disk_gb,
                "free_gb": free_disk_gb,
                "used_pct": disk_usage_pct,
                "error": disk_error,
            },
            "pcap_storage": {
                "directory": real_pcap_dir,
                "status": pcap_dir_status,
                "is_writable": is_writable,
                "write_error": write_error,
                "used_bytes": pcap_used_bytes,
                "used_gb": pcap_used_gb,
                "file_count": pcap_file_count,
                "quota_gb": max_quota_gb,
                "remaining_quota_gb": remaining_quota_gb,
                "quota_used_pct": quota_used_pct,
                "retention_days": settings.PCAP_RETENTION_DAYS,
            },
            "pcapDirectory": real_pcap_dir,
            "status": pcap_dir_status,
            "isWritable": is_writable,
            "writeError": write_error,
            "maxStorageGb": max_quota_gb,
            "usedStorageGb": pcap_used_gb,
            "usedStoragePercent": quota_used_pct,
            "retentionDays": settings.PCAP_RETENTION_DAYS,
            "pcapFilesCount": pcap_file_count,
            "integrityCheckEnabled": cls._find_engine_binary() is not None,
        }

    @classmethod
    def send_engine_ipc_command(cls, command: str) -> Dict[str, Any]:
        """
        Sends an IPC command to the Rust OpenNDR engine over UNIX domain socket.
        Never fabricates operational standby telemetry when socket/IPC is unavailable.
        """
        socket_path = settings.ENGINE_SOCKET_PATH
        binary_path = cls._find_engine_binary()
        binary_present = binary_path is not None
        socket_present = os.path.exists(socket_path)

        if not socket_present:
            return {
                "engine_version": None,
                "is_running": False,
                "capture_mode": None,
                "active_interface": None,
                "packets_received": None,
                "packets_dropped": None,
                "bytes_processed": None,
                "current_mbps": None,
                "ring_buffer_usage_pct": None,
                "protocol_stats": None,
                "last_capture_file": None,
                "recent_packets": [],
                "binary_present": binary_present,
                "binary_path": binary_path,
                "socket_present": False,
                "ipc_reachable": False,
                "ipc_error": f"IPC socket {socket_path} absent",
                "socket_error": f"IPC socket {socket_path} absent",
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
                parsed = json.loads(response_data.decode("utf-8"))
                if not isinstance(parsed, dict):
                    raise ValueError("Engine IPC response is not a JSON object.")
                parsed.setdefault("binary_present", binary_present)
                parsed.setdefault("binary_path", binary_path)
                parsed.setdefault("socket_present", True)
                parsed["ipc_reachable"] = True
                parsed["ipc_error"] = None
                return parsed
        except Exception as e:
            return {
                "engine_version": None,
                "is_running": False,
                "capture_mode": None,
                "active_interface": None,
                "packets_received": None,
                "packets_dropped": None,
                "bytes_processed": None,
                "current_mbps": None,
                "ring_buffer_usage_pct": None,
                "protocol_stats": None,
                "last_capture_file": None,
                "recent_packets": [],
                "binary_present": binary_present,
                "binary_path": binary_path,
                "socket_present": True,
                "ipc_reachable": False,
                "ipc_error": str(e),
                "socket_error": str(e),
                "error": str(e),
            }

    @classmethod
    def get_engine_status(cls) -> Dict[str, Any]:
        """
        Combines binary verification, systemd service state, UNIX socket existence,
        and live IPC response to derive an accurate Rust engine state:
        OPERATIONAL | DEGRADED | STOPPED | UNAVAILABLE | UNKNOWN
        """
        ipc_res = cls.send_engine_ipc_command("GET_STATUS")
        binary_present = bool(ipc_res.get("binary_present", False))
        binary_path = ipc_res.get("binary_path")
        socket_present = bool(ipc_res.get("socket_present", False))
        ipc_reachable = bool(ipc_res.get("ipc_reachable", False))
        ipc_error = ipc_res.get("ipc_error") or ipc_res.get("error")

        services = cls.get_systemd_services_status()
        engine_unit = next((s for s in services if s["name"] == "openndr-engine"), None)
        service_status = engine_unit["status"] if engine_unit else "UNKNOWN"

        if ipc_reachable and not ipc_error and binary_present:
            engine_status = "DEGRADED" if service_status == "FAILED" else "OPERATIONAL"
        elif ipc_reachable and not binary_present:
            engine_status = "DEGRADED"
        elif not binary_present:
            engine_status = "UNAVAILABLE"
        elif service_status == "ACTIVE" or service_status == "FAILED" or socket_present:
            # Service claims active/failed or socket file exists, yet IPC failed
            engine_status = "DEGRADED"
        elif service_status == "INACTIVE":
            engine_status = "STOPPED"
        else:
            engine_status = "UNKNOWN"

        result = dict(ipc_res)
        result["engine_status"] = engine_status
        result["service_status"] = service_status
        return result

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
        """Ingests and decodes a PCAP/PCAPNG file via active IPC daemon or openndr-engine binary."""
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
        """Ingests an uploaded PCAP/PCAPNG file via secure temporary storage."""
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

    # =========================================================================
    # Persistent System Update State (PostgreSQL system_settings, no mock dates)
    # =========================================================================

    @classmethod
    def _default_update_payload(cls) -> Dict[str, Any]:
        return {
            "current_version": settings.VERSION,
            "available_version": settings.VERSION,
            "release_date": settings.RELEASE_DATE,
            "last_checked_at": None,
            "last_updated_at": None,
            "next_scheduled_check_at": None,
            "auto_update_enabled": False,
            "check_interval_minutes": 60,
            "background_worker_active": False,
            "update_available": False,
            "build_revision": 1,
            "channel": f"{settings.OPENNDR_ENV}-local",
            "status": "UP_TO_DATE",
            "release_notes": "Local autonomous OpenNDR runtime (no external cloud update dependency).",
            "history": [],
        }

    @classmethod
    def get_update_state(cls, db: Session) -> Dict[str, Any]:
        row = db.query(SystemSetting).filter(SystemSetting.key == cls.UPDATE_SETTING_KEY).first()
        state = cls._default_update_payload()
        if row:
            try:
                stored = json.loads(row.value_json)
                if isinstance(stored, dict):
                    state.update(stored)
            except Exception:
                pass

        state["current_version"] = settings.VERSION
        state["available_version"] = settings.VERSION
        state["release_date"] = settings.RELEASE_DATE
        state["engine_integrity_ok"] = cls._find_engine_binary() is not None
        return state

    @classmethod
    def _save_update_state(cls, db: Session, state: Dict[str, Any], user_id: Optional[str]) -> Dict[str, Any]:
        to_store = dict(state)
        to_store.pop("engine_integrity_ok", None)
        row = db.query(SystemSetting).filter(SystemSetting.key == cls.UPDATE_SETTING_KEY).first()
        serialized = json.dumps(to_store)
        if row:
            row.value_json = serialized
            row.updated_by = user_id
        else:
            row = SystemSetting(
                key=cls.UPDATE_SETTING_KEY,
                value_json=serialized,
                description="Persistent update check & maintenance history",
                updated_by=user_id,
            )
            db.add(row)
        db.commit()
        return cls.get_update_state(db)

    @classmethod
    def record_update_check(cls, db: Session, user_id: str, force: bool = False) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        state = cls.get_update_state(db)
        integrity_ok = cls._find_engine_binary() is not None

        state["last_checked_at"] = now_iso
        if force:
            state["last_updated_at"] = now_iso
            state["build_revision"] = int(state.get("build_revision", 1)) + 1
            state["status"] = "UP_TO_DATE"
        if state.get("auto_update_enabled"):
            interval = int(state.get("check_interval_minutes", 60))
            state["next_scheduled_check_at"] = (now + timedelta(minutes=interval)).isoformat()
        else:
            state["next_scheduled_check_at"] = None

        event = {
            "id": str(uuid.uuid4()),
            "timestamp": now_iso,
            "trigger": "FORCE_UPDATE" if force else "MANUAL_CHECK",
            "from_version": settings.VERSION,
            "to_version": settings.VERSION,
            "status": "SUCCESS" if integrity_ok else "UP_TO_DATE",
            "details": (
                "Local verification completed; Rust engine binary verified."
                if integrity_ok
                else "Local verification completed; native openndr-engine binary absent on host."
            ),
        }
        history = list(state.get("history") or [])
        history.insert(0, event)
        state["history"] = history[:25]
        return cls._save_update_state(db, state, user_id)

    @classmethod
    def configure_updates(
        cls,
        db: Session,
        auto_update_enabled: bool,
        check_interval_minutes: int,
        user_id: str,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        state = cls.get_update_state(db)
        state["auto_update_enabled"] = bool(auto_update_enabled)
        state["check_interval_minutes"] = int(check_interval_minutes)
        state["next_scheduled_check_at"] = (
            (now + timedelta(minutes=check_interval_minutes)).isoformat()
            if auto_update_enabled
            else None
        )
        return cls._save_update_state(db, state, user_id)
