import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const allowedFile = path.join(srcDir, 'config', 'externalLinks.ts');
const scanExtensions = new Set(['.ts', '.tsx']);
const violations = [];

function scanDirectory(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
      continue;
    }

    if (!scanExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hasAppDomain = content.includes('app.agenteasepro.com');

    if (hasAppDomain && fullPath !== allowedFile) {
      violations.push(`Direct app domain reference is only allowed in src/config/externalLinks.ts: ${path.relative(root, fullPath)}`);
    }

    if (fullPath === allowedFile) {
      const deepLinkPattern = /https:\/\/app\.agenteasepro\.com\/(?:[^\s'"`]|$)/;
      if (deepLinkPattern.test(content)) {
        violations.push('Only app root is allowed. Remove deep app links from src/config/externalLinks.ts');
      }
    }
  }
}

scanDirectory(srcDir);

if (violations.length > 0) {
  console.error('\nWebsite boundary check failed:\n');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error('\nThis repo must remain marketing-site only (agenteasepro.com).\n');
  process.exit(1);
}

console.log('Website boundary check passed.');
