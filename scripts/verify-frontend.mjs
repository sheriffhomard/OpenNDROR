import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN_PATTERNS = [
  'MOCK_USERS',
  'INITIAL_USERS',
  'INITIAL_SERVICES',
  'INITIAL_INTERFACES',
  'INITIAL_STORAGE',
  'INITIAL_AUDIT_LOGS',
  'REVOKED_TOKENS',
  'switchRole',
  'simulated_sig',
  'runV01ValidationSuite',
  'Base.metadata.create_all',
  'pbkdf2:',
  'pbkdf2_hmac',
  'openndr_secure_password',
  'openndr_auto_generated_secure_secret_key_2026_debian13',
  'OpenNDR-Admin-2026!',
  '00:00:00:00:00:00',
  '52:54:00:12:34:56',
  '52:54:00:ab:cd:ef',
  '2026-11-17',
  'openndr-web',
  'Audited User',
  'server.ts',
  '"express"',
];

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.mts',
  '.py',
  '.sh',
  '.conf',
  '.template',
  '.json',
  '.service',
  '.ini',
  '.sql',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.venv',
  'target',
  '__pycache__',
  '.pytest_cache',
  'docs',
]);

const SKIP_RELATIVE_PREFIXES = [
  'backend/tests/',
  'public/assets/',
  'scripts/verify-frontend.mjs',
  'scripts/test-anti-mock.mjs',
  'scripts/verify-ui.mts',
];

// `backend/app/core/config.py` explicitly blacklists these insecure strings so
// `validate_production_invariants()` can reject them at startup.
const FILE_PATTERN_EXEMPTIONS = {
  'backend/app/core/config.py': new Set([
    'openndr_secure_password',
    'openndr_auto_generated_secure_secret_key_2026_debian13',
  ]),
};

export function scanTarget(targetPath, rootDir = process.cwd(), patterns = FORBIDDEN_PATTERNS) {
  const findings = [];
  if (!fs.existsSync(targetPath)) return findings;

  const stat = fs.statSync(targetPath);
  const relPath = path.relative(rootDir, targetPath).replaceAll('\\', '/');

  if (stat.isDirectory()) {
    const baseName = path.basename(targetPath);
    if (SKIP_DIRS.has(baseName)) return findings;
    if (SKIP_RELATIVE_PREFIXES.some((prefix) => relPath === prefix.slice(0, -1) || `${relPath}/`.startsWith(prefix))) {
      return findings;
    }

    for (const entry of fs.readdirSync(targetPath)) {
      findings.push(...scanTarget(path.join(targetPath, entry), rootDir, patterns));
    }
    return findings;
  }

  if (SKIP_RELATIVE_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(prefix))) {
    return findings;
  }

  const ext = path.extname(targetPath);
  if (!SCANNED_EXTENSIONS.has(ext) && !targetPath.endsWith('.env.example')) {
    return findings;
  }

  const content = fs.readFileSync(targetPath, 'utf-8');
  const exempt = FILE_PATTERN_EXEMPTIONS[relPath];

  for (const pattern of patterns) {
    if (exempt?.has(pattern)) continue;
    if (content.includes(pattern)) {
      findings.push({ file: relPath || targetPath, pattern });
    }
  }

  return findings;
}

export function scanTargets(targets, rootDir = process.cwd(), patterns = FORBIDDEN_PATTERNS) {
  const allFindings = [];
  for (const target of targets) {
    allFindings.push(...scanTarget(path.resolve(rootDir, target), rootDir, patterns));
  }
  return allFindings;
}

function main() {
  console.log('[*] Verifying OpenNDR V0.2 Anti-Mock & Production Integrity...');

  // 1. Ensure obsolete/demo files are gone
  for (const forbiddenFile of ['server.ts', 'deployment/systemd/openndr-web.service']) {
    if (fs.existsSync(forbiddenFile)) {
      console.error(`[FATAL] Obsolete prototype file must not exist: ${forbiddenFile}`);
      process.exit(1);
    }
  }

  // 2. Scan production code, backend, deployment configs, and build manifests
  const targets = [
    'src',
    'backend',
    'deployment',
    'scripts',
    'package.json',
    'vite.config.ts',
    '.env.example',
  ];

  const findings = scanTargets(targets);
  if (findings.length > 0) {
    for (const item of findings) {
      console.error(`[✗] Forbidden prototype pattern detected in ${item.file}: "${item.pattern}"`);
    }
    console.error(`[FATAL] ${findings.length} unauthorized prototype pattern(s) found.`);
    process.exit(1);
  }
  console.log('[✓] Zero prototype/mock/fallback patterns detected across runtime codebase and deployment.');

  // 3. Verify real REST API methods in src/services/api.ts
  const apiContent = fs.readFileSync('./src/services/api.ts', 'utf-8');
  const requiredMethods = [
    'login',
    'logout',
    'getCurrentUser',
    'getUsers',
    'createUser',
    'updateUserRole',
    'deleteUser',
    'getSystemStatus',
    'getInterfaces',
    'getIsolationCheck',
    'getStorage',
    'getAuditLogs',
    'getLiveness',
    'getReadiness',
    'getHealth',
    'getCaptureTelemetry',
    'startCapture',
    'stopCapture',
    'ingestPcap',
    'uploadPcap',
    'getUpdateStatus',
    'checkForUpdates',
    'forceSystemUpdate',
    'updateAutoUpdateConfig',
  ];

  for (const method of requiredMethods) {
    if (!apiContent.includes(`${method}(`)) {
      console.error(`[✗] Required API method missing in api.ts: ${method}`);
      process.exit(1);
    }
  }
  console.log('[✓] All REST /api/v1/* API methods are implemented and exported.');
  console.log('[✓] Anti-prototype & production integrity verification succeeded.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
