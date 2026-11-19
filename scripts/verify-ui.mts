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

console.log('[*] Running OpenNDR UI & State Honesty Suite (Section 10)...');

// 1. Verify obsolete navigation files are removed
for (const obsolete of [
  './src/components/Header.tsx',
  './src/components/Navigation.tsx',
  './src/components/HamburgerMenu.tsx',
  './src/components/ContextualOnboarding.tsx',
]) {
  assert.equal(fs.existsSync(obsolete), false, `Obsolete component must not exist: ${obsolete}`);
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

// 3. TopBar connection state & no duplicate settings button
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

// 4. DashboardView: unavailable backend vs zero-packet empty state vs degraded/operational states
{
  const unavailDash = renderToStaticMarkup(
    React.createElement(DashboardView, {
      isAuthenticated: true,
      connectionState: 'unavailable',
      lastRefreshedAt: null,
      isRefreshing: false,
      onRefresh: async () => {},
      health: null,
      services: [],
      interfaces: [],
      storage: null,
      telemetry: null,
      auditLogs: [],
      updateState: null,
      statusError: 'Serveur backend inaccessible.',
      onOpenLogin: () => {},
      onNavigateToCapture: () => {},
      onNavigateToInterfaces: () => {},
      onNavigateToDiagnostics: () => {},
    })
  );
  assert.ok(unavailDash.includes('Impossible de joindre le serveur API OpenNDR'));
  assert.ok(unavailDash.includes('Indisponible'));
  assert.equal(unavailDash.includes('Opérationnel'), false, 'Unavailable dashboard must never display Opérationnel');

  const emptyCaptureDash = renderToStaticMarkup(
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
        capture_engine: { version: '0.2.0', mode: 'STANDBY' },
        timestamp: '2026-11-19T00:00:00.000Z',
      },
      services: [
        { name: 'openndr-engine', unit: 'openndr-engine.service', status: 'ready', description: 'Engine' },
      ],
      interfaces: [],
      storage: null,
      telemetry: {
        engine_version: '0.2.0',
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
    })
  );
  assert.ok(emptyCaptureDash.includes('Aucune donnée de capture disponible'));
  assert.ok(emptyCaptureDash.includes('Interfaces non configurées'));
}

// 5. CaptureView & InterfacesView empty/null/breached honesty
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
      ],
      interfacesError: null,
      onRefresh: async () => {},
    })
  );
  assert.ok(breachInterfacesHtml.includes('enp2s0'));
  assert.ok(breachInterfacesHtml.includes('Non conforme'));
  assert.equal(breachInterfacesHtml.includes('100% STEALTH'), false);
}

// 6. AuditView null userRole, ValidationView pending state, SystemSettingsView null updateState
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

  const validationHtml = renderToStaticMarkup(
    React.createElement(ValidationView, { isAuthenticated: false })
  );
  assert.ok(validationHtml.includes('Non exécuté'));
  assert.equal(validationHtml.includes('Conforme'), false, 'Pending diagnostics must never appear Conforme');

  const settingsNullHtml = renderToStaticMarkup(
    React.createElement(SystemSettingsView, {
      health: null,
      updateState: null,
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
}

console.log('[✓] All Section 10 UI, RBAC & Data-Honesty assertions passed.');
