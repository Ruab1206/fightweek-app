/**
 * firestore-admin.cjs — Zero-dependency Firestore admin client for Node 16+.
 *
 * Uses a service account key (serviceAccountKey.json) to mint a Google OAuth2
 * access token, then talks to the Firestore REST API. Bypasses security rules.
 *
 * Supports: read, write, delete, list collections, batch operations.
 *
 * Usage:
 *   const db = require('./firestore-admin.cjs');
 *   await db.init();                              // loads key & gets token
 *   const doc = await db.readDoc('path/to/doc');  // read
 *   await db.writeDoc('path/to/doc', { ... });    // create/overwrite
 *   const items = await db.listCollection('path/to/col');  // list
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Config ──
const PROJECT_ID = 'fightweek-app';
const SCOPES = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let accessToken = null;
let tokenExpiry = 0;
let serviceAccount = null;

// ── Service account key loading ──

function loadServiceAccountKey() {
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.error(`\n❌ Service account key not found at:\n   ${keyPath}\n`);
    console.error('To generate one:');
    console.error('  1. Go to Firebase Console → Project settings → Service accounts');
    console.error('  2. Click "Generate new private key"');
    console.error('  3. Save the file as serviceAccountKey.json in the fightweek-app/ root\n');
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

// ── JWT creation & token exchange ──

function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');

  return `${unsigned}.${signature}`;
}

function exchangeJWTForToken() {
  return new Promise((resolve, reject) => {
    const jwt = createJWT();
    const body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`;

    const url = new URL(TOKEN_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Token exchange failed (${res.statusCode}): ${data.slice(0, 300)}`));
          return;
        }
        const parsed = JSON.parse(data);
        accessToken = parsed.access_token;
        tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000; // refresh 60s early
        resolve(accessToken);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function ensureToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    await exchangeJWTForToken();
  }
}

// ── HTTP helpers ──

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      const bodyStr = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} ${method} ${parsed.pathname}: ${data.slice(0, 300)}`));
          return;
        }
        resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function get(url) { await ensureToken(); return request('GET', url); }
async function patch(url, body) { await ensureToken(); return request('PATCH', url, body); }
async function del(url) { await ensureToken(); return request('DELETE', url); }
async function post(url, body) { await ensureToken(); return request('POST', url, body); }

// ── Firestore value encoding (JS → Firestore REST) ──

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') {
    // Auto-detect ISO timestamps
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      return { timestampValue: v };
    }
    return { stringValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue) } };
  }
  if (typeof v === 'object' && v instanceof Date) {
    return { timestampValue: v.toISOString() };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const [key, val] of Object.entries(v)) {
      fields[key] = encodeValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = encodeValue(val);
  }
  return fields;
}

// ── Firestore value decoding (Firestore REST → JS) ──

function decodeValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) return decodeFields(v.mapValue.fields || {});
  return v;
}

function decodeFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = decodeValue(v);
  return obj;
}

function decodeDocument(doc) {
  // Real document name must win: some legacy docs carry a stale stored `_id`
  // field (e.g. ""), which would otherwise overwrite the true id.
  return { ...decodeFields(doc.fields || {}), _id: doc.name.split('/').pop() };
}

// ── Public API ──

/**
 * Initialize: load service account key and get an access token.
 * Must be called before any other method.
 */
async function init() {
  loadServiceAccountKey();
  await exchangeJWTForToken();
}

/**
 * Read a single document by its full path.
 * Returns the decoded object, or null if not found.
 */
async function readDoc(docPath) {
  try {
    const data = await get(`${BASE}/${docPath}`);
    return data.fields ? decodeFields(data.fields) : null;
  } catch (e) {
    if (e.message.includes('404')) return null;
    throw e;
  }
}

/**
 * List all documents in a collection. Handles pagination automatically.
 * Returns an array of decoded objects (each includes _id).
 */
async function listCollection(colPath) {
  const items = [];
  let pageToken = null;
  do {
    let url = `${BASE}/${colPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const data = await get(url);
    if (data.documents) data.documents.forEach((d) => items.push(decodeDocument(d)));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return items;
}

/**
 * Write (create or overwrite) a document at a specific path.
 * @param {string} docPath — e.g. 'artifacts/production/public/data/backlog/item123'
 * @param {object} data — plain JS object to write
 */
async function writeDoc(docPath, data) {
  const body = { fields: encodeFields(data) };
  return patch(`${BASE}/${docPath}`, body);
}

/**
 * Update specific fields on a document (merge, not overwrite).
 * @param {string} docPath
 * @param {object} fields — only the fields to update
 */
async function updateDoc(docPath, fields) {
  const fieldPaths = Object.keys(fields).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const body = { fields: encodeFields(fields) };
  return patch(`${BASE}/${docPath}?${fieldPaths}`, body);
}

/**
 * Delete a document.
 */
async function deleteDoc(docPath) {
  return del(`${BASE}/${docPath}`);
}

/**
 * Add a document to a collection with an auto-generated ID.
 * Returns the created document (decoded).
 */
async function addDoc(colPath, data) {
  const body = { fields: encodeFields(data) };
  const result = await post(`${BASE}/${colPath}`, body);
  return result.fields ? decodeDocument(result) : result;
}

/**
 * Run a structured query against a collection.
 * @param {string} parentPath — e.g. 'artifacts/production/public/data'
 * @param {string} collectionId — e.g. 'backlog'
 * @param {object} where — optional: { field, op, value } (op: EQUAL, LESS_THAN, etc.)
 * @param {string} orderBy — optional field name to order by
 * @param {number} limit — optional max results
 */
async function query(parentPath, collectionId, { where, orderBy, limit } = {}) {
  const structuredQuery = { from: [{ collectionId }] };

  if (where) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: where.field },
        op: where.op || 'EQUAL',
        value: encodeValue(where.value),
      },
    };
  }

  if (orderBy) {
    structuredQuery.orderBy = [{ field: { fieldPath: orderBy }, direction: 'ASCENDING' }];
  }

  if (limit) {
    structuredQuery.limit = limit;
  }

  const result = await post(`${BASE}/${parentPath}:runQuery`, { structuredQuery });
  return (Array.isArray(result) ? result : [result])
    .filter((r) => r.document)
    .map((r) => decodeDocument(r.document));
}

// ── Convenience: FightWeek-specific paths ──

const PATHS = {
  publicData: 'artifacts/production/public/data',
  config: 'artifacts/production/public/data/config',
  roles: 'artifacts/production/public/data/config/roles',
  storyMap: 'artifacts/production/public/data/story-map/main',
  backlog: 'artifacts/production/public/data/backlog',
  feedback: 'artifacts/production/public/data/feedback',
  user: (name) => `artifacts/production/users/${name}`,
  userWeek: (name, week) => `artifacts/production/users/${name}/weeks/week_${week}`,
  userTemplate: (name) => `artifacts/production/users/${name}/templates/standard`,
};

module.exports = {
  init,
  readDoc,
  listCollection,
  writeDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  encodeValue,
  decodeValue,
  encodeFields,
  decodeFields,
  PATHS,
  PROJECT_ID,
};
