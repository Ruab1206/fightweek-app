// Polyfill crypto.getRandomValues for Node 16 + Vite 5 compatibility
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto;

// Now load Vite CLI
await import('./node_modules/vite/bin/vite.js');
