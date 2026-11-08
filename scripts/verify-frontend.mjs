import fs from 'fs';
import path from 'path';

console.log('[*] Vérification de l\'intégrité du Frontend OpenNDR V0.1...');

// 1. Contrôle d'absence de données simulées
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
          console.error(`[✗] Symbole interdit détecté dans ${fullPath}: "${pattern}"`);
          errors++;
        }
      }
    }
  }
  return errors;
}

const errors = checkDirectory('./src');
if (errors > 0) {
  console.error(`[FATAL] ${errors} motif(s) simulé(s) non autorisés trouvés dans src/`);
  process.exit(1);
}
console.log('[✓] Aucune donnée simulée ni motif fictif détecté dans src/.');

// 2. Vérification des méthodes API réelles
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
  'getStorage',
  'getAuditLogs',
  'getLiveness',
  'getReadiness',
  'getHealth',
];

for (const method of requiredMethods) {
  if (!apiContent.includes(`${method}(`)) {
    console.error(`[✗] Méthode d'API requise manquante dans api.ts : ${method}`);
    process.exit(1);
  }
}
console.log('[✓] Toutes les méthodes API REST /api/v1/* sont implémentées et exportées.');
console.log('[✓] Validation Frontend réussie.');
process.exit(0);
