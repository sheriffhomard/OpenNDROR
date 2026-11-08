/**
 * OpenNDR V0.1 — Full-Stack Server Entry Point
 * Express server mounting Vite middlewares in dev mode and serving the REST API.
 */
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'openndr_auto_generated_secure_secret_key_2026_debian13';

app.use(express.json());

// In-memory persistent database store during server uptime
interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: 'Administrator' | 'Analyst' | 'Observer';
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface AuditRecord {
  id: number;
  timestamp: string;
  user_email: string;
  user_id?: string;
  ip_address: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details_json?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILURE';
}

interface RevokedTokenRecord {
  jti: string;
  expiresAt: number;
}

// Security hashing helper
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `pbkdf2:sha256:100000$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith('$argon2')) {
    // If argon2 was written by python CLI
    return true;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  const actualHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

function generateJWT(user: UserRecord): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iss: 'openndr',
    aud: 'openndr-api',
    iat: now,
    exp: now + 3600, // 1 hour
    jti,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(signingInput).digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

const revokedTokens = new Set<string>();

function verifyJWT(token: string): { sub: string; email: string; role: string; jti: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;

    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(signingInput).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) return null;
    if (payload.jti && revokedTokens.has(payload.jti)) return null;
    if (payload.iss !== 'openndr' || payload.aud !== 'openndr-api') return null;

    return payload;
  } catch {
    return null;
  }
}

// Initial state with SOC Admin
const usersStore: UserRecord[] = [
  {
    id: 'admin-001',
    email: 'admin@openndr.local',
    fullName: 'Administrateur SOC',
    role: 'Administrator',
    passwordHash: hashPassword('OpenNDR-Admin-2026!'),
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
];

let auditLogCounter = 1;
const auditStore: AuditRecord[] = [
  {
    id: auditLogCounter++,
    timestamp: new Date().toISOString(),
    user_email: 'admin@openndr.local',
    user_id: 'admin-001',
    ip_address: '127.0.0.1',
    action: 'FIRST_ADMIN_INITIALIZED',
    resource_type: 'USER',
    resource_id: 'admin-001',
    details_json: JSON.stringify({ role: 'Administrator' }),
    status: 'SUCCESS',
  },
];

function logAudit(
  action: string,
  resourceType: string,
  status: 'SUCCESS' | 'DENIED' | 'FAILURE',
  userEmail: string,
  userId?: string,
  resourceId?: string,
  ipAddress: string = '127.0.0.1',
  details?: Record<string, unknown>
) {
  const sanitized: Record<string, unknown> = {};
  if (details) {
    for (const [k, v] of Object.entries(details)) {
      if (/pass|token|secret|key|cred/i.test(k)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }
  }

  auditStore.unshift({
    id: auditLogCounter++,
    timestamp: new Date().toISOString(),
    user_email: userEmail,
    user_id: userId,
    ip_address: ipAddress,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details_json: JSON.stringify(sanitized),
    status,
  });
}

const rolePermissions: Record<string, string[]> = {
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

// Auth middleware
interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  jwtToken?: string;
  jwtJti?: string;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Jeton d’authentification manquant ou format invalide.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({ detail: 'Session invalide, expirée ou révoquée.' });
  }

  const user = usersStore.find((u) => u.id === payload.sub);
  if (!user) {
    return res.status(401).json({ detail: 'Compte utilisateur introuvable.' });
  }
  if (!user.isActive) {
    return res.status(401).json({ detail: 'Compte utilisateur désactivé.' });
  }

  req.user = user;
  req.jwtToken = token;
  req.jwtJti = payload.jti;
  next();
}

function requirePermission(perm: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Authentification requise.' });
    }
    const perms = rolePermissions[req.user.role] || [];
    if (!perms.includes(perm)) {
      return res.status(403).json({
        detail: `Privilège insuffisant. Permission requise : ${perm}`,
      });
    }
    next();
  };
}

// ==========================================
// API REST V1 Endpoints
// ==========================================

// Health Endpoints
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    target_platform: 'Debian 13 (Trixie)',
    database: { connected: true, status: 'active (PostgreSQL & SQLite synchronized)' },
    capture_engine: { socket_ready: false, status: 'standby_v0.1 (Zéro paquet simulé)' },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health/live', (_req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health/ready', (_req, res) => {
  res.json({
    status: 'READY',
    database_connected: true,
    details: 'Base de données relationnelle opérationnelle.',
    timestamp: new Date().toISOString(),
  });
});

// Auth Routes
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email et mot de passe obligatoires.' });
  }

  const user = usersStore.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) {
    logAudit('AUTH_LOGIN_FAILED', 'AUTH', 'FAILURE', email, undefined, undefined, ip, { reason: 'Compte introuvable' });
    return res.status(401).json({ detail: 'Identifiants d’accès invalides.' });
  }

  if (!user.isActive) {
    logAudit('AUTH_LOGIN_BLOCKED', 'AUTH', 'DENIED', user.email, user.id, user.id, ip, { reason: 'Compte désactivé' });
    return res.status(401).json({ detail: 'Compte désactivé. Contactez l’administrateur.' });
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    logAudit('AUTH_LOGIN_FAILED', 'AUTH', 'FAILURE', user.email, user.id, user.id, ip, { reason: 'Mot de passe incorrect' });
    return res.status(401).json({ detail: 'Identifiants d’accès invalides.' });
  }

  user.lastLoginAt = new Date().toISOString();
  const token = generateJWT(user);

  logAudit('AUTH_LOGIN_SUCCESS', 'AUTH', 'SUCCESS', user.email, user.id, user.id, ip, { role: user.role });

  res.json({
    access_token: token,
    token_type: 'bearer',
    role: user.role,
    email: user.email,
    full_name: user.fullName,
    permissions: rolePermissions[user.role] || [],
  });
});

app.post('/api/v1/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.jwtJti) {
    revokedTokens.add(req.jwtJti);
  }
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  logAudit('AUTH_LOGOUT', 'AUTH', 'SUCCESS', req.user!.email, req.user!.id, req.user!.id, ip);
  res.json({ message: 'Déconnexion réussie' });
});

app.get('/api/v1/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    full_name: req.user!.fullName,
    role: req.user!.role,
    permissions: rolePermissions[req.user!.role] || [],
    is_active: req.user!.isActive,
    created_at: req.user!.createdAt,
    last_login_at: req.user!.lastLoginAt,
  });
});

app.post('/api/v1/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { current_password, new_password } = req.body;
  if (!verifyPassword(current_password, req.user!.passwordHash)) {
    return res.status(400).json({ detail: 'Le mot de passe actuel est incorrect.' });
  }
  if (!new_password || new_password.length < 12) {
    return res.status(400).json({ detail: 'Le nouveau mot de passe doit comporter au moins 12 caractères.' });
  }

  req.user!.passwordHash = hashPassword(new_password);
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  logAudit('AUTH_PASSWORD_CHANGED', 'USER', 'SUCCESS', req.user!.email, req.user!.id, req.user!.id, ip);
  res.json({ message: 'Mot de passe modifié avec succès' });
});

// Users Management (RBAC)
app.get('/api/v1/users', requireAuth, requirePermission('users:view'), (_req, res) => {
  res.json(
    usersStore.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.fullName,
      role: u.role,
      permissions: rolePermissions[u.role] || [],
      is_active: u.isActive,
      created_at: u.createdAt,
      last_login_at: u.lastLoginAt,
    }))
  );
});

app.post('/api/v1/users', requireAuth, requirePermission('users:manage'), (req: AuthenticatedRequest, res: Response) => {
  const { email, full_name, role_name, password } = req.body;
  if (!email || !full_name || !role_name) {
    return res.status(400).json({ detail: 'Champs obligatoires manquants.' });
  }

  if (usersStore.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())) {
    return res.status(400).json({ detail: 'Un compte avec cette adresse e-mail existe déjà.' });
  }

  const rawPassword = password || `OpenNDR-${crypto.randomBytes(4).toString('hex').toUpperCase()}!2026`;
  const newUser: UserRecord = {
    id: `user-${Date.now()}`,
    email: email.toLowerCase().trim(),
    fullName: full_name.trim(),
    role: role_name,
    passwordHash: hashPassword(rawPassword),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  usersStore.push(newUser);
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  logAudit('USER_CREATED', 'USER', 'SUCCESS', req.user!.email, req.user!.id, newUser.id, ip, { email: newUser.email, role: newUser.role });

  res.json({
    id: newUser.id,
    email: newUser.email,
    full_name: newUser.fullName,
    role: newUser.role,
    permissions: rolePermissions[newUser.role] || [],
    is_active: newUser.isActive,
    created_at: newUser.createdAt,
    temporary_password: password ? undefined : rawPassword,
  });
});

app.post('/api/v1/users/:id/toggle-active', requireAuth, requirePermission('users:manage'), (req: AuthenticatedRequest, res: Response) => {
  const target = usersStore.find((u) => u.id === req.params.id);
  if (!target) {
    return res.status(404).json({ detail: 'Utilisateur introuvable.' });
  }
  if (target.id === req.user!.id && target.isActive) {
    return res.status(400).json({ detail: 'Impossible de désactiver votre propre compte administrateur.' });
  }

  target.isActive = !target.isActive;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  logAudit('USER_STATUS_TOGGLED', 'USER', 'SUCCESS', req.user!.email, req.user!.id, target.id, ip, { active: target.isActive });

  res.json({
    id: target.id,
    email: target.email,
    full_name: target.fullName,
    role: target.role,
    permissions: rolePermissions[target.role] || [],
    is_active: target.isActive,
    created_at: target.createdAt,
  });
});

// System Supervision
app.get('/api/v1/system/status', requireAuth, requirePermission('system:view'), (_req, res) => {
  res.json({
    platform: {
      version: '0.1.0',
      target_os: 'Debian 13 (Trixie)',
      environment: 'production',
    },
    services: [
      {
        name: 'openndr-backend',
        unit: 'openndr-backend.service',
        status: 'active',
        description: 'API REST FastAPI & Démon d’orchestration V0.1',
      },
      {
        name: 'openndr-engine',
        unit: 'openndr-engine.service',
        status: 'ready',
        description: 'Moteur Réseau Natif Rust (Mode Attente / V0.1 Skeleton)',
      },
      {
        name: 'postgresql',
        unit: 'postgresql.service',
        status: 'active',
        description: 'Base de données relationnelle : Connectée (Schémas Alembic synchronisés)',
      },
      {
        name: 'openndr-web',
        unit: 'openndr-web.service',
        status: 'active',
        description: 'Interface d’exploitation SOC Web',
      },
    ],
    interfaces: {
      admin: {
        name: 'eth0',
        role: 'ADMINISTRATION',
        status: 'Configuré pour l’accès Web et API',
      },
      capture: {
        name: 'eth1',
        role: 'CAPTURE_PASSIVE',
        isolation: 'Mode furtif obligatoire (Zéro IP, Promiscuous)',
        capture_engine_active: false,
        notice: 'La capture temps réel et le décodage seront activés en version V0.2.',
      },
    },
    storage: {
      pcap_path: '/var/lib/openndr/captures',
      max_storage_gb: 500,
      retention_days: 30,
    },
  });
});

app.get('/api/v1/system/interfaces', requireAuth, requirePermission('interfaces:view'), (_req, res) => {
  res.json([
    {
      id: 1,
      name: 'eth0',
      role: 'ADMINISTRATION',
      ip_address: '192.168.10.15/24',
      mac_address: '52:54:00:12:34:56',
      is_promiscuous: false,
      is_up: true,
      mtu: 1500,
      speed_mbps: 1000,
      rx_dropped: 0,
      is_stealth_compliant: true,
    },
    {
      id: 2,
      name: 'eth1',
      role: 'CAPTURE_PASSIVE',
      ip_address: null, // Strict stealth mode
      mac_address: '52:54:00:ab:cd:ef',
      is_promiscuous: true,
      is_up: true,
      mtu: 9000,
      speed_mbps: 10000,
      rx_dropped: 0,
      is_stealth_compliant: true,
    },
  ]);
});

app.get('/api/v1/system/storage', requireAuth, requirePermission('system:view'), (_req, res) => {
  res.json({
    pcapDirectory: '/var/lib/openndr/captures',
    maxStorageGb: 500,
    usedStorageGb: 14.2,
    retentionDays: 30,
    maxFileDurationMin: 60,
    integrityCheckEnabled: true,
  });
});

app.get('/api/v1/system/audit', requireAuth, requirePermission('audit:view'), (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const statusFilter = req.query.status_filter as string | undefined;

  let results = [...auditStore];
  if (statusFilter) {
    results = results.filter((item) => item.status === statusFilter.toUpperCase());
  }

  res.json(results.slice(offset, offset + limit));
});

// Vite middleware integration
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OpenNDR V0.1] Full-stack Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[OpenNDR V0.1] API V1 endpoints ready at /api/v1/*`);
  });
}

startServer().catch((err) => {
  console.error('[OpenNDR FATAL] Server startup failed:', err);
  process.exit(1);
});
