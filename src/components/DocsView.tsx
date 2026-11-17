import React, { useState } from 'react';
import {
  Milestone,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

export const DocsView: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<'adr' | 'install' | 'specs' | 'roadmap'>('roadmap');

  const roadmapMilestones = [
    {
      version: 'V0.1',
      title: 'Technical Foundations & Architecture',
      status: 'COMPLETED',
      completed: true,
      points: [
        '3-tier modular architecture (Rust Engine, FastAPI Backend, React Web UI)',
        'Server-enforced RBAC access control (Administrator, Analyst, Observer)',
        'Strict network interface separation (eth0 admin vs eth1 passive capture)',
        'PostgreSQL schemas and initial Alembic migrations',
        'Debian 13 systemd units and install/uninstall scripts',
      ],
    },
    {
      version: 'V0.2',
      title: 'Packet Capture & Decoding',
      status: 'COMPLETED',
      completed: true,
      points: [
        'Real-time passive AF_PACKET capture (PACKET_MMAP TPACKET_V2 ring buffer) & libpcap compatibility',
        'PCAP / PCAPNG trace ingestion and decoding',
        'Hierarchical L2–L4 decoding: Ethernet II, 802.1Q VLAN, ARP, IPv4, IPv6, ICMP, TCP, UDP',
        'Local rotating PCAP writer and interactive Web packet explorer',
      ],
    },
    {
      version: 'V0.3',
      title: 'Flows & Protocols',
      status: 'NEXT MILESTONE',
      completed: false,
      points: [
        'TCP/UDP stream reconstruction and session state tracking',
        'Protocol parsers: DNS, DHCP, HTTP, TLS metadata (SNI/JA3), SSH',
        'Bounded memory management for active network sessions',
      ],
    },
    {
      version: 'V0.4',
      title: 'Autonomous Detection Engine',
      status: 'PLANNED',
      completed: false,
      points: [
        'Signature and network pattern detection rule engine',
        'Behavioral & threshold-based detection (port scans, sweeps, DNS tunneling)',
        'Security alerting system with explainable technical evidence',
      ],
    },
    {
      version: 'V0.5',
      title: 'Correlation & Incident Management',
      status: 'PLANNED',
      completed: false,
      points: [
        'Multi-source temporal alert correlation engine',
        'Security incident cases, timelines, and investigation notes',
        'Alert deduplication and noise reduction',
      ],
    },
    {
      version: 'V1.0',
      title: 'First Production-Stable Release',
      status: 'FINAL TARGET',
      completed: false,
      points: [
        'Fully sovereign NDR platform with zero mandatory third-party dependencies',
        'Full Debian packaging, 100+ Mbps load testing, and security audits',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Technical Documentation &amp; Roadmap</span>
              <HelpTooltip title="Embedded Documentation" description="Offline reference manuals built directly into the console covering the roadmap, architecture decisions, Debian install steps, and API routes." />
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Browse technical specifications, Architecture Decision Records (ADRs), and operations guides
              embedded directly within the OpenNDR platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setActiveDoc('roadmap')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'roadmap' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Roadmap (V0.1 - V1.0)
            </button>
            <button
              type="button"
              onClick={() => setActiveDoc('adr')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'adr' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              ADR Decisions
            </button>
            <button
              type="button"
              onClick={() => setActiveDoc('install')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'install' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Debian 13 Setup
            </button>
            <button
              type="button"
              onClick={() => setActiveDoc('specs')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'specs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Specs &amp; API
            </button>
          </div>
        </div>
      </div>

      {/* Doc Content Area */}
      {activeDoc === 'roadmap' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Milestone className="w-4 h-4 text-emerald-500" />
              <span>Official OpenNDR Product Roadmap</span>
              <HelpTooltip title="Milestone Progression" description="Shows completed releases (V0.1, V0.2) and upcoming releases (V0.3 to V1.0)." />
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Methodical milestone-driven evolution with strict acceptance criteria before each version transition.
            </p>
          </div>

          <div className="space-y-4">
            {roadmapMilestones.map((m) => (
              <div
                key={m.version}
                className={`p-4 rounded-xl border transition-colors ${
                  m.completed
                    ? 'bg-emerald-50/50 dark:bg-slate-950/70 border-emerald-500/40'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{m.version}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{m.title}</span>
                  </div>

                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                      m.completed
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : m.status === 'NEXT MILESTONE'
                        ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {m.points.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {m.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 mt-0.5 text-slate-400 dark:text-slate-600 shrink-0" />
                      )}
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeDoc === 'adr' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">ADR-001</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Accepted · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Selection of Rust for the Network Analysis Engine
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Decision:</strong> Implement all packet decoders, flow state machines, and DPI in Rust.
              Eliminates memory-corruption vulnerabilities (Buffer Overflows, Use-After-Free) that traditionally affect C/C++ decoders processing untrusted traffic, while maintaining equivalent throughput with no garbage collector.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">ADR-002</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Accepted · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              FastAPI &amp; SQLAlchemy Orchestration Backend
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Decision:</strong> Use FastAPI (Python 3.10+) for the management service, REST API, user lifecycle, and authentication.
              The backend performs no packet capture within HTTP worker processes and communicates with the Rust engine strictly over a dedicated local UNIX socket.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">ADR-003</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Accepted · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Strict Separation Between Management and Capture Interfaces
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Decision:</strong> Enforce 2 distinct physical network interfaces. The passive interface connected to SPAN/TAP must have no IP address (0.0.0.0), no routing, and blocks all ARP replies or outbound packet transmission via kernel sysctl hardening.
            </p>
          </div>
        </div>
      )}

      {activeDoc === 'install' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span>Debian 13 (Trixie) Installation &amp; Deployment Guide</span>
            <HelpTooltip title="Native Debian Commands" description="Run these four shell commands as root/sudo on a fresh Debian 13 server to install OpenNDR without Docker." />
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            OpenNDR is designed to run natively on Debian with no mandatory Docker dependency, managed by systemd.
          </p>

          <div className="space-y-3 font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-slate-500"># 1. Check system prerequisites (CPU, RAM, interfaces)</div>
            <div className="text-emerald-700 dark:text-emerald-400">sudo bash deployment/debian/check-prerequisites.sh</div>

            <div className="text-slate-500 pt-2"># 2. Run native installation script</div>
            <div className="text-emerald-700 dark:text-emerald-400">sudo bash deployment/debian/install.sh</div>

            <div className="text-slate-500 pt-2"># 3. Start systemd daemons</div>
            <div className="text-emerald-700 dark:text-emerald-400">sudo systemctl enable --now openndr-backend openndr-engine openndr-web</div>

            <div className="text-slate-500 pt-2"># 4. Verify platform health status</div>
            <div className="text-emerald-700 dark:text-emerald-400">curl -s http://127.0.0.1:8000/api/v1/health | jq</div>
          </div>
        </div>
      )}

      {activeDoc === 'specs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span>V0.2 REST API Endpoint Specification</span>
            <HelpTooltip title="API Reference" description="HTTP routes exposed at /api/v1/* for SIEM integration, health checks, capture orchestration, and update checks." />
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Standardized OpenAPI interface contracts for SIEM and SOC console integration.
          </p>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/health</span>
              </div>
              <span className="text-slate-500">Public · Platform &amp; engine health check</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sky-600 dark:text-sky-400 font-bold">POST</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/auth/login</span>
              </div>
              <span className="text-slate-500">Public · Argon2/JWT authentication</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/auth/me</span>
              </div>
              <span className="text-slate-500">Bearer Auth · User profile</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/status</span>
              </div>
              <span className="text-slate-500">system:view · Services &amp; engine telemetry</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/capture/telemetry</span>
              </div>
              <span className="text-slate-500">system:view · Throughput, drops &amp; L2–L4 counters</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sky-600 dark:text-sky-400 font-bold">POST</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/capture/start | stop</span>
              </div>
              <span className="text-slate-500">interfaces:manage · AF_PACKET capture control</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sky-600 dark:text-sky-400 font-bold">POST</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/capture/ingest-pcap | upload-pcap</span>
              </div>
              <span className="text-slate-500">interfaces:manage · PCAP/PCAPNG trace decoding</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/updates</span>
              </div>
              <span className="text-slate-500">System release date, auto-update &amp; force sync</span>
            </div>
            <div className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">GET</span>
                <span className="text-slate-900 dark:text-slate-200">/api/v1/system/audit</span>
              </div>
              <span className="text-slate-500">audit:view · Security audit log</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
