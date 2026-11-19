import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanTargets } from './verify-frontend.mjs';

console.log('[*] Running Anti-Mock Scanner Negative Regression Tests...');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openndr-antimock-'));
try {
  const fakeSrcDir = path.join(tmpRoot, 'src');
  const fakeBackendDir = path.join(tmpRoot, 'backend', 'app');
  fs.mkdirSync(fakeSrcDir, { recursive: true });
  fs.mkdirSync(fakeBackendDir, { recursive: true });

  // 1. Clean temporary fixture should produce zero findings
  const cleanFile = path.join(fakeSrcDir, 'clean.ts');
  fs.writeFileSync(cleanFile, 'export const status = "OPERATIONAL";\n', 'utf-8');
  assert.equal(scanTargets(['src'], tmpRoot).length, 0, 'Clean fixture must report 0 findings');

  // 2. Injecting prototype patterns must be detected immediately
  const dirtyFrontend = path.join(fakeSrcDir, 'dirty.ts');
  fs.writeFileSync(
    dirtyFrontend,
    'const fakeMac = "00:00:00:00:00:00";\nconst MOCK_USERS = [];\n',
    'utf-8'
  );

  const dirtyBackend = path.join(fakeBackendDir, 'dirty.py');
  fs.writeFileSync(
    dirtyBackend,
    'REVOKED_TOKENS = set()\nBase.metadata.create_all(bind=engine)\nh = "pbkdf2:sha256:100$a$b"\n',
    'utf-8'
  );

  const findings = scanTargets(['src', 'backend'], tmpRoot);
  const detectedPatterns = new Set(findings.map((f) => f.pattern));

  for (const expected of [
    '00:00:00:00:00:00',
    'MOCK_USERS',
    'REVOKED_TOKENS',
    'Base.metadata.create_all',
    'pbkdf2:',
  ]) {
    assert.ok(
      detectedPatterns.has(expected),
      `Scanner failed to detect injected forbidden pattern: ${expected}`
    );
  }

  console.log(`[✓] Negative regression test passed (${findings.length} injected patterns caught).`);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
