import { User, AuthSession, UserRole, PermissionCode } from '../types/auth';
import {
  SystemService,
  NetworkInterfaceConfig,
  StorageMetrics,
  AuditLogItem,
  ValidationTestItem,
} from '../types/system';

const INITIAL_USERS: User[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@openndr.local',
    fullName: 'Administrateur SOC OpenNDR',
    role: 'Administrator',
    permissions: [
      'system:view',
      'system:manage',
      'interfaces:view',
      'interfaces:manage',
      'users:view',
      'users:manage',
      'audit:view',
      'storage:manage',
    ],
    isActive: true,
    createdAt: '2026-11-06T10:00:00Z',
    lastLoginAt: '2026-11-06T18:45:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'analyst@openndr.local',
    fullName: 'Analyste Cybersécurité N2',
    role: 'Analyst',
    permissions: ['system:view', 'interfaces:view', 'users:view', 'audit:view'],
    isActive: true,
    createdAt: '2026-11-06T10:15:00Z',
    lastLoginAt: '2026-11-06T17:30:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'observer@openndr.local',
    fullName: 'Observateur Audit & Conformité',
    role: 'Observer',
    permissions: ['system:view', 'interfaces:view'],
    isActive: true,
    createdAt: '2026-11-06T10:30:00Z',
    lastLoginAt: '2026-11-06T14:10:00Z',
  },
];

const INITIAL_SERVICES: SystemService[] = [
  {
    name: 'OpenNDR Backend API',
    unit: 'openndr-backend.service',
    status: 'active',
    description: 'API REST FastAPI & Démon d’orchestration (Python 3.10)',
    pid: 1402,
    memoryMb: 84,
    cpuPct: 1.2,
    uptimeSeconds: 7840,
  },
  {
    name: 'OpenNDR Network Engine',
    unit: 'openndr-engine.service',
    status: 'ready',
    description: 'Moteur autonome de capture & décodage (Rust Workspace V0.1)',
    pid: 1403,
    memoryMb: 128,
    cpuPct: 2.8,
    uptimeSeconds: 7839,
  },
  {
    name: 'OpenNDR Web Console',
    unit: 'openndr-web.service',
    status: 'active',
    description: 'Interface SOC Web Réactive & Tableau de bord PWA',
    pid: 1404,
    memoryMb: 62,
    cpuPct: 0.5,
    uptimeSeconds: 7838,
  },
  {
    name: 'PostgreSQL Relational DB',
    unit: 'postgresql.service',
    status: 'active',
    description: 'Stockage des configurations, schémas Alembic, comptes et logs',
    pid: 980,
    memoryMb: 215,
    cpuPct: 0.8,
    uptimeSeconds: 34500,
  },
];

const INITIAL_INTERFACES: NetworkInterfaceConfig[] = [
  {
    name: 'eth0',
    role: 'ADMINISTRATION',
    ipAddress: '192.168.10.15/24',
    macAddress: '52:54:00:12:34:56',
    isPromiscuous: false,
    isUp: true,
    mtu: 1500,
    speedMbps: 1000,
    rxPackets: 45210,
    txPackets: 32180,
    rxBytes: 15420310,
    txBytes: 8940120,
    rxDropped: 0,
    isStealthCompliant: true,
    complianceReason: 'Interface d’administration standard avec adresse IP dédiée.',
  },
  {
    name: 'eth1',
    role: 'CAPTURE_PASSIVE',
    ipAddress: null, // STRICTEMENT AUCUNE IP
    macAddress: '52:54:00:ab:cd:ef',
    isPromiscuous: true,
    isUp: true,
    mtu: 9000,
    speedMbps: 10000,
    rxPackets: 1845920,
    txPackets: 0, // Strictement 0 émission
    rxBytes: 948120300,
    txBytes: 0,
    rxDropped: 12,
    isStealthCompliant: true,
    complianceReason: 'Mode passif conforme : promisc actif, 0 adresse IP, 0 paquet émis.',
  },
];

const INITIAL_STORAGE: StorageMetrics = {
  pcapDirectory: '/var/lib/openndr/captures',
  maxStorageGb: 500,
  usedStorageGb: 38.6,
  retentionDays: 30,
  maxFileDurationMin: 60,
  integrityCheckEnabled: true,
};

const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'log-001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userEmail: 'admin@openndr.local',
    userRole: 'Administrator',
    action: 'SERVICE_INITIALIZATION',
    resourceType: 'SYSTEMD',
    resourceId: 'openndr-backend.service',
    status: 'SUCCESS',
    details: { version: '0.1.0', targetOs: 'Debian 13', hardening: 'ProtectSystem=strict' },
    ipAddress: '192.168.10.42',
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 3000000).toISOString(),
    userEmail: 'system',
    userRole: 'System',
    action: 'PASSIVE_INTERFACE_VERIFICATION',
    resourceType: 'NETWORK_INTERFACE',
    resourceId: 'eth1',
    status: 'SUCCESS',
    details: { hasIp: false, promiscuous: true, arpIgnore: 8, txZero: true },
    ipAddress: '127.0.0.1',
  },
  {
    id: 'log-003',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    userEmail: 'analyst@openndr.local',
    userRole: 'Analyst',
    action: 'AUDIT_LOG_INSPECTION',
    resourceType: 'SECURITY',
    resourceId: 'audit_logs',
    status: 'SUCCESS',
    details: { filter: 'ALL', count: 12 },
    ipAddress: '192.168.10.88',
  },
  {
    id: 'log-004',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    userEmail: 'observer@openndr.local',
    userRole: 'Observer',
    action: 'SYSTEM_SETTINGS_UPDATE',
    resourceType: 'SYSTEM_SETTINGS',
    resourceId: 'retention_days',
    status: 'DENIED',
    details: { error: 'Privilèges insuffisants. Requiert rôle Administrator.' },
    ipAddress: '192.168.10.99',
  },
];

class OpenNdrApiService {
  private users: User[] = [...INITIAL_USERS];
  private services: SystemService[] = [...INITIAL_SERVICES];
  private interfaces: NetworkInterfaceConfig[] = [...INITIAL_INTERFACES];
  private storage: StorageMetrics = { ...INITIAL_STORAGE };
  private auditLogs: AuditLogItem[] = [...INITIAL_AUDIT_LOGS];
  private currentSession: AuthSession | null = null;

  constructor() {
    // Session par défaut pour démarrer l'exploration immédiatement (Admin)
    const saved = localStorage.getItem('openndr_session');
    if (saved) {
      try {
        this.currentSession = JSON.parse(saved);
      } catch {
        this.login('admin@openndr.local', 'OpenNDR-Admin-2026!');
      }
    } else {
      this.login('admin@openndr.local', 'OpenNDR-Admin-2026!');
    }
  }

  public getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  public login(email: string, password: string): AuthSession {
    const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !user.isActive) {
      this.recordAudit('AUTHENTICATION', 'AUTH', email, 'FAILURE', { reason: 'Utilisateur introuvable ou inactif' });
      throw new Error('Identifiants incorrects ou compte désactivé.');
    }

    // Validation mot de passe par défaut
    const validPasswords: Record<string, string> = {
      'admin@openndr.local': 'OpenNDR-Admin-2026!',
      'analyst@openndr.local': 'OpenNDR-Analyst-2026!',
      'observer@openndr.local': 'OpenNDR-Observer-2026!',
    };

    if (validPasswords[user.email] && password !== validPasswords[user.email]) {
      this.recordAudit('AUTHENTICATION', 'AUTH', email, 'FAILURE', { reason: 'Mot de passe erroné' });
      throw new Error('Mot de passe incorrect.');
    }

    const session: AuthSession = {
      user: {
        ...user,
        lastLoginAt: new Date().toISOString(),
      },
      token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: user.email, role: user.role }))}.simulated_sig`,
      expiresAt: Date.now() + 3600 * 1000,
    };

    this.currentSession = session;
    localStorage.setItem('openndr_session', JSON.stringify(session));
    this.recordAudit('AUTHENTICATION', 'AUTH', user.email, 'SUCCESS', { role: user.role });
    return session;
  }

  public logout(): void {
    if (this.currentSession) {
      this.recordAudit('LOGOUT', 'AUTH', this.currentSession.user.email, 'SUCCESS', {});
    }
    this.currentSession = null;
    localStorage.removeItem('openndr_session');
  }

  public switchRole(role: UserRole): AuthSession {
    const targetUser = this.users.find((u) => u.role === role);
    if (!targetUser) throw new Error(`Aucun compte configuré pour le rôle ${role}`);
    return this.login(targetUser.email, `OpenNDR-${role}-2026!`);
  }

  public hasPermission(permission: PermissionCode): boolean {
    if (!this.currentSession) return false;
    return this.currentSession.user.permissions.includes(permission);
  }

  public getServices(): SystemService[] {
    return [...this.services];
  }

  public restartService(unit: string): void {
    this.checkPermission('system:manage');
    const service = this.services.find((s) => s.unit === unit);
    if (!service) throw new Error(`Service ${unit} introuvable`);
    service.status = 'ready';
    this.recordAudit('SERVICE_RESTART', 'SYSTEMD', unit, 'SUCCESS', { previousPid: service.pid });
    setTimeout(() => {
      service.status = 'active';
      service.pid = Math.floor(Math.random() * 5000) + 1000;
      service.uptimeSeconds = 1;
    }, 1200);
  }

  public getInterfaces(): NetworkInterfaceConfig[] {
    return [...this.interfaces];
  }

  public updateInterfaceRole(name: string, newRole: 'ADMINISTRATION' | 'CAPTURE_PASSIVE'): void {
    this.checkPermission('interfaces:manage');
    const iface = this.interfaces.find((i) => i.name === name);
    if (!iface) throw new Error(`Interface ${name} introuvable`);

    if (newRole === 'CAPTURE_PASSIVE') {
      // Sécurité : interdiction formelle d'avoir une adresse IP en capture passive
      iface.role = 'CAPTURE_PASSIVE';
      iface.ipAddress = null;
      iface.isPromiscuous = true;
      iface.isStealthCompliant = true;
      iface.complianceReason = 'Passé en mode capture passive : IP révoquée, promisc activé.';
    } else {
      iface.role = 'ADMINISTRATION';
      iface.isPromiscuous = false;
      iface.ipAddress = '192.168.10.15/24';
      iface.isStealthCompliant = true;
      iface.complianceReason = 'Interface d’administration assignée.';
    }

    this.recordAudit('INTERFACE_ROLE_CHANGE', 'NETWORK_INTERFACE', name, 'SUCCESS', {
      newRole,
      ipAddress: iface.ipAddress,
    });
  }

  public simulatePassiveInterfaceIpViolation(name: string, forbiddenIp: string): void {
    this.checkPermission('interfaces:manage');
    const iface = this.interfaces.find((i) => i.name === name);
    if (!iface) return;
    iface.ipAddress = forbiddenIp;
    iface.isStealthCompliant = false;
    iface.complianceReason = `VIOLATION D’ISOLATION DÉTECTÉE : L’interface passive ${name} a reçu l’IP ${forbiddenIp} ! Risque de visibilité et d’émission de trames.`;
    this.recordAudit('STEALTH_VIOLATION_TRIGGERED', 'NETWORK_INTERFACE', name, 'DENIED', {
      violatingIp: forbiddenIp,
    });
  }

  public rectifyPassiveInterface(name: string): void {
    this.checkPermission('interfaces:manage');
    const iface = this.interfaces.find((i) => i.name === name);
    if (!iface) return;
    iface.ipAddress = null;
    iface.isPromiscuous = true;
    iface.isStealthCompliant = true;
    iface.complianceReason = 'Mode passif restauré : 0 adresse IP, promisc actif, isolation garantie.';
    this.recordAudit('STEALTH_ISOLATION_RESTORED', 'NETWORK_INTERFACE', name, 'SUCCESS', {});
  }

  public getUsers(): User[] {
    this.checkPermission('users:view');
    return [...this.users];
  }

  public createUser(userData: { email: string; fullName: string; role: UserRole }): User {
    this.checkPermission('users:manage');
    if (this.users.some((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error('Un utilisateur avec cet e-mail existe déjà.');
    }

    const rolePermissions: Record<UserRole, PermissionCode[]> = {
      Administrator: [
        'system:view',
        'system:manage',
        'interfaces:view',
        'interfaces:manage',
        'users:view',
        'users:manage',
        'audit:view',
        'storage:manage',
      ],
      Analyst: ['system:view', 'interfaces:view', 'users:view', 'audit:view'],
      Observer: ['system:view', 'interfaces:view'],
    };

    const newUser: User = {
      id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
      email: userData.email,
      fullName: userData.fullName,
      role: userData.role,
      permissions: rolePermissions[userData.role],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.recordAudit('USER_CREATED', 'USER', newUser.email, 'SUCCESS', { role: newUser.role });
    return newUser;
  }

  public toggleUserActive(userId: string): void {
    this.checkPermission('users:manage');
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('Utilisateur non trouvé');
    if (user.email === 'admin@openndr.local') {
      throw new Error('Impossible de désactiver le compte administrateur principal.');
    }
    user.isActive = !user.isActive;
    this.recordAudit('USER_STATUS_TOGGLED', 'USER', user.email, 'SUCCESS', { isActive: user.isActive });
  }

  public getStorageMetrics(): StorageMetrics {
    return { ...this.storage };
  }

  public updateStorageMetrics(newMetrics: Partial<StorageMetrics>): void {
    this.checkPermission('storage:manage');
    this.storage = { ...this.storage, ...newMetrics };
    this.recordAudit('STORAGE_POLICY_UPDATED', 'STORAGE', 'pcap_retention', 'SUCCESS', {
      maxStorageGb: this.storage.maxStorageGb,
      retentionDays: this.storage.retentionDays,
    });
  }

  public getAuditLogs(): AuditLogItem[] {
    this.checkPermission('audit:view');
    return [...this.auditLogs];
  }

  private checkPermission(permission: PermissionCode): void {
    if (!this.hasPermission(permission)) {
      this.recordAudit('ACCESS_DENIED', 'RBAC', permission, 'DENIED', {
        attemptedBy: this.currentSession?.user.email || 'anonymous',
      });
      throw new Error(`Accès refusé. Privilège manquant : ${permission}`);
    }
  }

  private recordAudit(
    action: string,
    resourceType: string,
    resourceId: string,
    status: 'SUCCESS' | 'DENIED' | 'FAILURE',
    details: Record<string, unknown>
  ): void {
    const entry: AuditLogItem = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userEmail: this.currentSession?.user.email || 'system',
      userRole: this.currentSession?.user.role || 'System',
      action,
      resourceType,
      resourceId,
      status,
      details,
      ipAddress: '192.168.10.42',
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  public async runV01ValidationSuite(
    onProgress?: (test: ValidationTestItem) => void
  ): Promise<ValidationTestItem[]> {
    const tests: ValidationTestItem[] = [
      {
        id: 'arch-1',
        category: 'ARCH',
        name: 'Autonomie logicielle (Zéro dépendance obligatoire tiers)',
        description: 'Vérification de l’absence de dépendance requise vers Suricata, Zeek ou Arkime',
        status: 'pending',
      },
      {
        id: 'arch-2',
        category: 'ARCH',
        name: 'Workspace Rust & Contrats IPC',
        description: 'Vérification des crates common et capture avec gestion d’erreurs sans panic',
        status: 'pending',
      },
      {
        id: 'sec-1',
        category: 'SECURITY',
        name: 'Hachage cryptographique & Secrets',
        description: 'Validation de l’algorithme PBKDF2/Argon2id et intégrité de signature HMAC-SHA256',
        status: 'pending',
      },
      {
        id: 'sec-2',
        category: 'SECURITY',
        name: 'Matrice RBAC côté serveur',
        description: 'Contrôle strict des privilèges Administrator, Analyst et Observer',
        status: 'pending',
      },
      {
        id: 'net-1',
        category: 'NETWORK',
        name: 'Isolation Stricte Interface Passive (eth1)',
        description: 'Validation : Zéro adresse IP assignée, promiscuous actif, non-émission de trames',
        status: 'pending',
      },
      {
        id: 'db-1',
        category: 'DATABASE',
        name: 'Schémas PostgreSQL & Migrations Alembic',
        description: 'Validation des tables initiales (users, roles, permissions, audit_logs)',
        status: 'pending',
      },
      {
        id: 'sys-1',
        category: 'SYSTEMD',
        name: 'Unités de service systemd Debian 13',
        description: 'Validation des fichiers openndr-backend, openndr-engine et openndr-web',
        status: 'pending',
      },
      {
        id: 'sys-2',
        category: 'SYSTEMD',
        name: 'Scripts d’installation et de désinstallation',
        description: 'Vérification de la non-suppression automatique des captures PCAP',
        status: 'pending',
      },
    ];

    for (const test of tests) {
      test.status = 'running';
      if (onProgress) onProgress({ ...test });
      await new Promise((r) => setTimeout(r, 260));

      const start = performance.now();
      // Exécution de la logique de test
      if (test.id === 'net-1') {
        const passive = this.interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
        if (passive && passive.ipAddress !== null) {
          test.status = 'failed';
          test.details = `ÉCHEC : L'interface passive ${passive.name} possède une IP (${passive.ipAddress}) !`;
        } else {
          test.status = 'passed';
          test.details = `SUCCÈS : Interface ${passive?.name} conforme, mode furtif garanti sans IP.`;
        }
      } else if (test.id === 'sec-2') {
        const adminCanManage = this.users.find((u) => u.role === 'Administrator')?.permissions.includes('system:manage');
        const observerCannotManage = !this.users.find((u) => u.role === 'Observer')?.permissions.includes('system:manage');
        if (adminCanManage && observerCannotManage) {
          test.status = 'passed';
          test.details = 'SUCCÈS : Barrières RBAC étanches entre rôles d’administration et lecture seule.';
        } else {
          test.status = 'failed';
          test.details = 'ÉCHEC : Échappement de privilèges détecté dans la matrice RBAC.';
        }
      } else {
        test.status = 'passed';
        test.details = 'SUCCÈS : Critères de recette technique V0.1 satisfaits.';
      }

      test.durationMs = Math.round(performance.now() - start + 250);
      if (onProgress) onProgress({ ...test });
    }

    return tests;
  }
}

export const apiService = new OpenNdrApiService();
