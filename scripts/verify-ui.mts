import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '../src/components/Sidebar';
import { TopBar } from '../src/components/TopBar';
import { DashboardView } from '../src/components/DashboardView';
import { CaptureView } from '../src/components/CaptureView';
import { InterfacesView } from '../src/components/InterfacesView';
import { AuditView } from '../src/components/AuditView';
import { ValidationView } from '../src/components/ValidationView';
import { SystemSettingsView } from '../src/components/SystemSettingsView';
import { RbacView } from '../src/components/RbacView';
import { DocsView } from '../src/components/DocsView';
import { User, PermissionCode } from '../src/types/auth';

function makeUser(role: User['role'], permissions: PermissionCode[]): User {
  return {
    id: `test-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@domain.local`,
    fullName: `Compte ${role}`,
    role,
    permissions,
    isActive: true,
    createdAt: '2026-11-19T00:00:00.000Z',
  };
}

function renderDash(overrides: Partial<React.ComponentProps<typeof DashboardView>> = {}) {
  return renderToStaticMarkup(
    React.createElement(DashboardView, {
      isAuthenticated: true,
      connectionState: 'connected',
      lastRefreshedAt: '2026-11-19T00:00:00.000Z',
      isRefreshing: false,
      onRefresh: async () => {},
      health: {
        status: 'HEALTHY',
        version: '0.2.0',
        target_platform: 'Debian 13 (Trixie)',
        database: { connected: true, status: 'CONNECTED' },
        capture_engine: {
          engine_status: 'OPERATIONAL',
          version: '0.2.0',
          mode: 'STANDBY',
          binary_present: true,
          ipc_reachable: true,
        },
        timestamp: '2026-11-19T00:00:00.000Z',
      },
      services: [
        { name: 'openndr-engine', unit: 'openndr-engine.service', status: 'ACTIVE', description: 'Engine' },
      ],
      interfaces: [],
      storage: null,
      telemetry: {
        engine_version: '0.2.0',
        engine_status: 'OPERATIONAL',
        binary_present: true,
        ipc_reachable: true,
        is_running: false,
        capture_mode: 'STANDBY',
        active_interface: null,
        packets_received: 0,
        packets_dropped: 0,
        bytes_processed: 0,
        current_mbps: 0,
        ring_buffer_usage_pct: 0,
        protocol_stats: {
          tcp_packets: 0,
          udp_packets: 0,
          icmp_packets: 0,
          arp_packets: 0,
          ipv4_packets: 0,
          ipv6_packets: 0,
          vlan_packets: 0,
          other_packets: 0,
        },
        last_capture_file: null,
      },
      auditLogs: [],
      updateState: null,
      statusError: null,
      onOpenLogin: () => {},
      onNavigateToCapture: () => {},
      onNavigateToInterfaces: () => {},
      onNavigateToDiagnostics: () => {},
      ...overrides,
    })
  );
}

console.log('[*] Running OpenNDR V0.2 UI & State Honesty Suite...');

// 1. Verify obsolete navigation files are removed
for (const obsolete of [
  './src/components/Header.tsx',
  './src/components/Navigation.tsx',
  './src/components/HamburgerMenu.tsx',
  './src/components/ContextualOnboarding.tsx',
  './server.ts',
  './deployment/systemd/openndr-web.service',
]) {
  assert.equal(fs.existsSync(obsolete), false, `Obsolete file must not exist: ${obsolete}`);
}

// 2. Navigation & RBAC visibility
{
  const unauthHtml = renderToStaticMarkup(
    React.createElement(Sidebar, {
      activeSection: 'dashboard',
      onSelectSection: () => {},
      currentUser: null,
      platformVersion: '0.2.0',
      collapsed: false,
      onToggleCollapse: () => {},
      mobileOpen: false,
      onCloseMobile: () => {},
      hasInterfaceViolation: false,
      updateAvailable: false,
    })
  );
  assert.ok(unauthHtml.includes('Vue d&#x27;ensemble'));
  assert.ok(unauthHtml.includes('État et diagnostics'));
  assert.ok(unauthHtml.includes('Paramètres système'));
  assert.ok(unauthHtml.includes('Documentation'));
  assert.equal(unauthHtml.includes('Capture réseau'), false, 'Unauthenticated user must not see Capture réseau');
  assert.equal(unauthHtml.includes('Interfaces réseau'), false, 'Unauthenticated user must not see Interfaces réseau');
  assert.equal(unauthHtml.includes('Utilisateurs et rôles'), false, 'Unauthenticated user must not see Utilisateurs et rôles');
  assert.equal(unauthHtml.includes('Journal d&#x27;audit'), false, 'Unauthenticated user must not see Journal d\'audit');

  const observer = makeUser('Observer', ['system:view', 'interfaces:view']);
  const obsHtml = renderToStaticMarkup(
    React.createElement(Sidebar, {
      activeSection: 'capture',
      onSelectSection: () => {},
      currentUser: observer,
      platformVersion: '0.2.0',
      collapsed: false,
      onToggleCollapse: () => {},
      mobileOpen: false,
      onCloseMobile: () => {},
      hasInterfaceViolation: false,
      updateAvailable: false,
    })
  );
  assert.ok(obsHtml.includes('Capture réseau'), 'Observer must see Capture réseau');
  assert.ok(obsHtml.includes('Interfaces réseau'), 'Observer must see Interfaces réseau');
  assert.ok(obsHtml.includes('aria-current="page"'), 'Active section must have aria-current="page"');
  assert.equal(obsHtml.includes('Utilisateurs et rôles'), false, 'Observer must not see Utilisateurs et rôles');
  assert.equal(obsHtml.includes('Journal d&#x27;audit'), false, 'Observer must not see Journal d\'audit');
}

// 3. TopBar connection state
{
  const topBarUnavailable = renderToStaticMarkup(
    React.createElement(TopBar, {
      activeSection: 'dashboard',
      currentUser: null,
      connectionState: 'unavailable',
      theme: 'dark',
      onToggleTheme: () => {},
      onOpenMobileMenu: () => {},
      onOpenLogin: () => {},
      onLogout: () => {},
    })
  );
  assert.ok(topBarUnavailable.includes('Serveur indisponible'));
  assert.ok(topBarUnavailable.includes('Connexion'));
}

// 4. DashboardView: unavailable backend, empty capture, and all 5 engine states
{
  const unavailDash = renderDash({
    connectionState: 'unavailable',
    lastRefreshedAt: null,
    health: null,
    services: [],
    telemetry: null,
    statusError: 'Serveur backend inaccessible.',
  });
  assert.ok(unavailDash.includes('Impossible de joindre le serveur API OpenNDR'));
  assert.ok(unavailDash.includes('Indisponible'));
  assert.equal(unavailDash.includes('Opérationnel'), false, 'Unavailable dashboard must never display Opérationnel');

  const emptyCaptureDash = renderDash();
  assert.ok(emptyCaptureDash.includes('Aucune donnée de capture disponible'));
  assert.ok(emptyCaptureDash.includes('Interfaces non configurées'));

  // Engine binary absent must NEVER render engine as Opérationnel
  const missingBinaryDash = renderDash({
    health: {
      status: 'DEGRADED',
      version: '0.2.0',
      target_platform: 'Debian 13 (Trixie)',
      database: { connected: true, status: 'CONNECTED' },
      capture_engine: {
        engine_status: 'UNAVAILABLE',
        binary_present: false,
        ipc_reachable: false,
        ipc_error: 'openndr-engine binary not found',
      },
      timestamp: '2026-11-19T00:00:00.000Z',
    },
    telemetry: {
      engine_version: null,
      engine_status: 'UNAVAILABLE',
      binary_present: false,
      ipc_reachable: false,
      ipc_error: 'openndr-engine binary not found',
      is_running: false,
      capture_mode: null,
      active_interface: null,
      packets_received: null,
      packets_dropped: null,
      bytes_processed: null,
      current_mbps: null,
      ring_buffer_usage_pct: null,
      protocol_stats: null,
      last_capture_file: null,
    },
  });
  assert.ok(missingBinaryDash.includes('Binaire openndr-engine absent'));

  // Stopped engine must display Arrêté (not Opérationnel on the engine row)
  const stoppedEngineDash = renderDash({
    health: {
      status: 'DEGRADED',
      version: '0.2.0',
      target_platform: 'Debian 13 (Trixie)',
      database: { connected: true, status: 'CONNECTED' },
      capture_engine: {
        engine_status: 'STOPPED',
        binary_present: true,
        ipc_reachable: false,
        ipc_error: 'Socket missing',
      },
      timestamp: '2026-11-19T00:00:00.000Z',
    },
    services: [
      { name: 'openndr-engine', unit: 'openndr-engine.service', status: 'INACTIVE', description: 'Engine' },
    ],
    telemetry: {
      engine_version: '0.2.0',
      engine_status: 'STOPPED',
      binary_present: true,
      ipc_reachable: false,
      ipc_error: 'Socket missing',
      is_running: false,
      capture_mode: null,
      active_interface: null,
      packets_received: null,
      packets_dropped: null,
      bytes_processed: null,
      current_mbps: null,
      ring_buffer_usage_pct: null,
      protocol_stats: null,
      last_capture_file: null,
    },
  });
  assert.ok(stoppedEngineDash.includes('Arrêté'));

  // Degraded engine
  const degradedEngineDash = renderDash({
    telemetry: {
      engine_version: '0.2.0',
      engine_status: 'DEGRADED',
      binary_present: true,
      ipc_reachable: false,
      ipc_error: 'Connection refused',
      is_running: false,
      capture_mode: null,
      active_interface: null,
      packets_received: null,
      packets_dropped: null,
      bytes_processed: null,
      current_mbps: null,
      ring_buffer_usage_pct: null,
      protocol_stats: null,
      last_capture_file: null,
    },
  });
  assert.ok(degradedEngineDash.includes('En fonctionnement dégradé'));

  // Unknown engine
  const unknownEngineDash = renderDash({
    health: {
      status: 'HEALTHY',
      version: '0.2.0',
      target_platform: 'Debian 13 (Trixie)',
      database: { connected: true, status: 'CONNECTED' },
      capture_engine: {
        engine_status: 'UNKNOWN',
      },
      timestamp: '2026-11-19T00:00:00.000Z',
    },
    services: [
      { name: 'openndr-engine', unit: 'openndr-engine.service', status: 'UNKNOWN', description: 'Engine' },
    ],
    telemetry: {
      engine_version: null,
      engine_status: 'UNKNOWN',
      is_running: false,
      capture_mode: null,
      active_interface: null,
      packets_received: null,
      packets_dropped: null,
      bytes_processed: null,
      current_mbps: null,
      ring_buffer_usage_pct: null,
      protocol_stats: null,
      last_capture_file: null,
    },
  });
  assert.ok(unknownEngineDash.includes('Inconnu'));
}

// 5. CaptureView: null telemetry, null protocol_stats, and STOPPED/UNAVAILABLE/DEGRADED states
{
  const nullCaptureHtml = renderToStaticMarkup(
    React.createElement(CaptureView, {
      telemetry: null,
      telemetryError: null,
      canManageCapture: false,
      onRefreshTelemetry: async () => {},
      onNotify: () => {},
    })
  );
  assert.ok(nullCaptureHtml.includes('Télémétrie du moteur indisponible'));
  assert.equal(nullCaptureHtml.includes('eth1'), false, 'CaptureView must never hardcode eth1');

  const unavailEngineCapture = renderToStaticMarkup(
    React.createElement(CaptureView, {
      telemetry: {
        engine_version: null,
        engine_status: 'UNAVAILABLE',
        binary_present: false,
        ipc_reachable: false,
        ipc_error: 'Binary missing',
        is_running: false,
        capture_mode: null,
        active_interface: null,
        packets_received: null,
        packets_dropped: null,
        bytes_processed: null,
        current_mbps: null,
        ring_buffer_usage_pct: null,
        protocol_stats: null,
        last_capture_file: null,
      },
      telemetryError: null,
      canManageCapture: true,
      onRefreshTelemetry: async () => {},
      onNotify: () => {},
    })
  );
  assert.ok(unavailEngineCapture.includes('Indisponible'));
  assert.ok(unavailEngineCapture.includes('Binary missing'));
  assert.equal(unavailEngineCapture.includes('Démarrer la capture'), false, 'Must not offer Start Capture when IPC unreachable');
}

// 6. InterfacesView: nullable MAC, MTU, speedMbps, rxDropped vs genuine 0, and isolationCheck details
{
  const breachInterfacesHtml = renderToStaticMarkup(
    React.createElement(InterfacesView, {
      interfaces: [
        {
          name: 'enp2s0',
          role: 'CAPTURE_PASSIVE',
          ipAddress: '192.168.10.50/24',
          macAddress: 'aa:bb:cc:dd:ee:ff',
          isPromiscuous: true,
          isUp: true,
          mtu: 1500,
          speedMbps: 1000,
          rxDropped: 0,
          isStealthCompliant: false,
        },
        {
          name: 'enp3s0',
          role: 'ADMINISTRATION',
          ipAddress: '10.0.0.10/24',
          macAddress: null,
          isPromiscuous: false,
          isUp: true,
          mtu: null,
          speedMbps: null,
          rxDropped: null,
          isStealthCompliant: false,
        },
      ],
      isolationCheck: {
        interface: 'enp2s0',
        status: 'ISOLATION_BREACHED',
        validation_result: 'FAILED',
        is_isolated: false,
        has_ip: true,
        has_routes: true,
        is_promiscuous: true,
        details: 'IPv4 address detected on passive capture interface',
        observed_state: {
          interface_exists: true,
          is_same_as_admin: false,
          ipv4_addresses: ['192.168.10.50/24'],
          ipv6_addresses: [],
          routes: ['192.168.10.0/24'],
          is_up: true,
          operstate: 'up',
          is_promiscuous: true,
          capture_ready: false,
        },
      },
      interfacesError: null,
      onRefresh: async () => {},
    })
  );
  assert.ok(breachInterfacesHtml.includes('enp2s0'));
  assert.ok(breachInterfacesHtml.includes('Non conforme'));
  assert.ok(breachInterfacesHtml.includes('Inconnu'), 'Null rxDropped must display Inconnu');
  assert.ok(breachInterfacesHtml.includes('Non disponible'), 'Null speedMbps/macAddress/mtu must display Non disponible');
  assert.equal(breachInterfacesHtml.includes('null Mbps'), false, 'Must NEVER render null Mbps');
  assert.equal(breachInterfacesHtml.includes('00:00:00:00:00:00'), false);
  assert.equal(breachInterfacesHtml.includes('100% STEALTH'), false);
}

// 7. AuditView, ValidationView, SystemSettingsView (RBAC & null handling), RbacView, DocsView
{
  const auditHtml = renderToStaticMarkup(
    React.createElement(AuditView, {
      logs: [
        {
          id: '1',
          timestamp: '2026-11-19T10:00:00.000Z',
          userEmail: 'op@domain.local',
          userRole: null,
          action: 'AUTH_LOGIN_SUCCESS',
          resourceType: 'AUTH',
          resourceId: '1',
          status: 'SUCCESS',
          details: {},
          ipAddress: '127.0.0.1',
        },
      ],
      hasViewPermission: true,
    })
  );
  assert.equal(auditHtml.includes('Audited User'), false, 'Must never inject fake Audited User');

  const validationHtmlUnauth = renderToStaticMarkup(
    React.createElement(ValidationView, { isAuthenticated: false })
  );
  assert.ok(validationHtmlUnauth.includes('Non exécuté'));
  assert.ok(validationHtmlUnauth.includes('Aucune vérification exécutée'));
  assert.equal(validationHtmlUnauth.includes('Conforme'), false, 'Pending diagnostics must never appear Conforme');

  const validationHtmlAuth = renderToStaticMarkup(
    React.createElement(ValidationView, { isAuthenticated: true })
  );
  assert.ok(validationHtmlAuth.includes('Non exécuté'));
  assert.equal(validationHtmlAuth.includes('Conforme'), false, 'Authenticated unexecuted diagnostics must never appear Conforme');

  const settingsNullHtml = renderToStaticMarkup(
    React.createElement(SystemSettingsView, {
      health: null,
      updateState: null,
      isAuthenticated: false,
      canManageUpdates: false,
      isCheckingUpdate: false,
      isForcingUpdate: false,
      isSavingConfig: false,
      onCheckForUpdates: async () => {},
      onForceUpdate: async () => {},
      onUpdateAutoConfig: async () => {},
      theme: 'dark',
      onSetTheme: () => {},
      onOpenLegalModal: () => {},
      onNotify: () => {},
    })
  );
  assert.ok(settingsNullHtml.includes('Non disponible'));
  assert.equal(settingsNullHtml.includes('2026-11-17'), false, 'Must never invent fallback release date');
  assert.equal(settingsNullHtml.includes('v0.2.0'), false, 'Must never invent fallback version when null');

  const settingsReadOnlyHtml = renderToStaticMarkup(
    React.createElement(SystemSettingsView, {
      health: null,
      isAuthenticated: true,
      canManageUpdates: false,
      updateState: {
        current_version: '0.2.0',
        available_version: '0.2.0',
        release_date: null,
        last_checked_at: null,
        last_updated_at: null,
        next_scheduled_check_at: null,
        auto_update_enabled: false,
        check_interval_minutes: 15,
        background_worker_active: false,
        update_available: false,
        build_revision: 1,
        channel: 'stable',
        status: 'UP_TO_DATE',
        release_notes: 'OpenNDR V0.2',
        engine_integrity_ok: true,
        history: [],
      },
      isCheckingUpdate: false,
      isForcingUpdate: false,
      isSavingConfig: false,
      onCheckForUpdates: async () => {},
      onForceUpdate: async () => {},
      onUpdateAutoConfig: async () => {},
      theme: 'dark',
      onSetTheme: () => {},
      onOpenLegalModal: () => {},
      onNotify: () => {},
    })
  );
  assert.ok(settingsReadOnlyHtml.includes('system:manage'));
  assert.ok(settingsReadOnlyHtml.includes('Non disponible'));

  const rbacRestrictedHtml = renderToStaticMarkup(
    React.createElement(RbacView, {
      users: [],
      hasViewPermission: false,
      canManageUsers: false,
      onToggleUserActive: async () => {},
      onCreateUser: async () => ({
        user: makeUser('Observer', ['system:view']),
      }),
    })
  );
  assert.ok(rbacRestrictedHtml.includes('Accès restreint'));

  const docsHtml = renderToStaticMarkup(React.createElement(DocsView));
  assert.ok(docsHtml.includes('Documentation'));
  assert.equal(docsHtml.includes('openndr-web'), false, 'DocsView must not reference obsolete openndr-web service');
}

console.log('[✓] All OpenNDR V0.2 UI, RBAC & Data-Honesty assertions passed.');
