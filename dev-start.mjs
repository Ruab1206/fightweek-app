// Polyfill crypto.getRandomValues for Vite 5 compatibility.
// On Node 24 globalThis.crypto exists but is a Proxy whose methods throw
// ERR_INVALID_THIS when Vite calls them detached. Replace it with an object
// whose methods are bound to webcrypto so the `this` binding is preserved.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webcrypto } = require('crypto');

const boundCrypto = {
  getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  randomUUID: webcrypto.randomUUID.bind(webcrypto),
  subtle: webcrypto.subtle,
};
Object.defineProperty(globalThis, 'crypto', {
  value: boundCrypto,
  configurable: true,
  enumerable: false,
  writable: false,
});

// Now load Vite CLI
await import('./node_modules/vite/bin/vite.js');
