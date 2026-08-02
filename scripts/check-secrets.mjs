import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.vite', 'out', 'dist', 'build', 'release']);
const ignoredFiles = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'check-secrets.mjs']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.env', '.txt']);
const patterns = [
  { name: 'OpenAI-style secret', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Bearer token literal', regex: /Bearer\s+[A-Za-z0-9._-]{24,}/gi },
  { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'hardcoded API key assignment', regex: /(?:api[-_]?key|secret|token|password)\s*[:=]\s*["'][^"'\n]{16,}["']/gi }
];

const findings = [];
walk(root);

if (findings.length > 0) {
  console.error('Potential secrets detected:');
  for (const finding of findings) console.error(`- ${finding.file}:${finding.line} ${finding.pattern}`);
  process.exit(1);
}

console.log('Secret scan passed. No high-confidence hardcoded credentials found.');

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (ignoredFiles.has(entry.name)) continue;
    const extension = entry.name === '.env.example' ? '.env' : path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(extension)) continue;
    const content = fs.readFileSync(absolute, 'utf8');
    for (const { name, regex } of patterns) {
      regex.lastIndex = 0;
      for (const match of content.matchAll(regex)) {
        const before = content.slice(0, match.index ?? 0);
        findings.push({ file: path.relative(root, absolute), line: before.split('\n').length, pattern: name });
      }
    }
  }
}
