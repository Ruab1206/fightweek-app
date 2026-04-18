// Patch Vite's bundle to use webcrypto (which has getRandomValues) for Node 16 compat
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'node_modules', 'vite', 'dist', 'node', 'chunks', 'dep-BK3b2jBa.js');
let content = fs.readFileSync(file, 'utf8');

const oldImport = "import crypto$2, { createHash as createHash$2 } from 'node:crypto';";
const newImport = [
  "import crypto_orig, { createHash as createHash$2, webcrypto as _wc } from 'node:crypto';",
  "const crypto$2 = new Proxy(crypto_orig, { get(t, p) { return (_wc && _wc[p]) ? _wc[p] : t[p]; } });"
].join('\n');

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  fs.writeFileSync(file, content);
  console.log('✅ Patched Vite for Node 16 crypto compatibility');
} else if (content.includes('crypto_orig')) {
  console.log('ℹ️  Already patched');
} else {
  console.log('❌ Could not find expected import pattern');
}
