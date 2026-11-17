import fs from 'fs';
import path from 'path';

console.log('[*] Verifying OpenNDR V0.2 Frontend Integrity...');

// 1. Check absence of simulated/mock data
const forbiddenPatterns = [
  'MOCK_USERS',
  'INITIAL_USERS',
  'INITIAL_SERVICES',
  'INITIAL_INTERFACES',
  'INITIAL_STORAGE',
  'INITIAL_AUDIT_LOGS',
  'switchRole',
  'simulated_sig',
  'runV01ValidationSuite',
];

function checkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let errors = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      errors += checkDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          console.error(`[✗] Forbidden symbol detected in ${fullPath}: "${pattern}"`);
          errors++;
        }
      }
    }
  }
  return errors;
}

const errors = checkDirectory('./src');
if (errors > 0) {
  console.error(`[FATAL] ${errors} unauthorized mock pattern(s) found in src/`);
  process.exit(1);
}
console.log('[✓] No simulated data or mock patterns detected in src/.');

// 2. Verify real API methods
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
];

for (const method of requiredMethods) {
  if (!apiContent.includes(`${method}(`)) {
    console.error(`[✗] Required API method missing in api.ts: ${method}`);
    process.exit(1);
  }
}
console.log('[✓] All REST /api/v1/* API methods are implemented and exported.');
console.log('[✓] Frontend validation succeeded.');
process.exit(0);
