/**
 * firestore.cjs — AI Agent's direct Firestore read/write client.
 *
 * Uses a Google Cloud service account key to authenticate against the
 * Firestore REST API. Bypasses security rules (service account = admin).
 * Works on Node 16+ with zero npm dependencies.
 *
 * ─── Setup (one-time) ───
 * 1. Firebase Console → Project settings → Service accounts
 * 2. Click "Generate new private key"
 * 3. Save as  fightweek-app/serviceAccountKey.json
 * 4. The .gitignore already excludes this file.
 *
 * ─── Usage ───
 *
 *   Read all data to data/ folder:
 *     node scripts/firestore.cjs read
 *
 *   Read a single document:
 *     node scripts/firestore.cjs get <path>
 *     node scripts/firestore.cjs get artifacts/production/public/data/story-map/main
 *
 *   Read a collection:
 *     node scripts/firestore.cjs list <path>
 *     node scripts/firestore.cjs list artifacts/production/public/data/backlog
 *
 *   Write a document (from JSON file or stdin):
 *     node scripts/firestore.cjs set <path> <jsonFile>
 *     node scripts/firestore.cjs set artifacts/production/public/data/backlog/item-123 data/new-item.json
 *
 *   Delete a document:
 *     node scripts/firestore.cjs delete <path>
 *
 * All commands output JSON to stdout (except 'read' which writes files).
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Config ───
const PROJECT_ID = 'fightweek-app';
const KEY_FILE = path.join(__dirname, '..', 'serviceAccountKey.json');
const OUT_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DATA = 'artifacts/production/public/data';
const USERS_ROOT = 'artifacts/production/users';
const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl'];
const SCOPES = 'https://www.googleapis.com/auth/datastore';

// ─── Load service account key ───
function loadKey() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`\n❌ Service account key not found: ${KEY_FILE}`);
    console.error(`\n   To set up:`);
    console.error(`   1. Go to Firebase Console → Project settings → Service accounts`);
    console.error(`   2. Click "Generate new private key"`);
    console.error(`   3. Save the file as: serviceAccountKey.json`);
    console.error(`   4. Place it in the fightweek-app/ root folder\n`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
}

// ─── JWT + OAuth2 token exchange (zero dependencies) ───
function base64url(data) {
  return (typeof data === 'string' ? Buffer.from(data) : data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createSignedJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: SCOPES,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = base64url(sign.sign(sa.private_key));
  return `${unsigned}.${signature}`;
}

function exchangeJwtForAccessToken(jwt) {
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`Token exchange failed (${res.statusCode}): ${d.slice(0, 300)}`));
        resolve(JSON.parse(d).access_token);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

let _accessToken = null;

async function getAccessToken() {
  if (_accessToken) return _accessToken;
  const sa = loadKey();
  const jwt = createSignedJwt(sa);
  _accessToken = await exchangeJwtForAccessToken(jwt);
  return _accessToken;
}

// ─── HTTP helpers ───
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(method, url, body) {
  return new Promise(async (resolve, reject) => {
    const token = await getAccessToken();
    const bodyStr = body ? JSON.stringify(body) : null;
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} ${method} ${parsed.pathname}: ${d.slice(0, 400)}`));
        resolve(d ? JSON.parse(d) : null);
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Firestore value encoding/decoding ───
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
  return { _id: doc.name.split('/').pop(), _path: doc.name, ...decodeFields(doc.fields || {}) };
}

function encodeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') {
    // Check if it looks like a Firestore timestamp
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return { timestampValue: val };
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: encodeFields(val) } };
  }
  return { stringValue: String(val) };
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_id' || k === '_path') continue; // strip metadata
    fields[k] = encodeValue(v);
  }
  return fields;
}

// ─── Core operations ───

async function getDoc(docPath) {
  const data = await request('GET', `${BASE_URL}/${docPath}`);
  return data.fields ? decodeDocument(data) : null;
}

async function listCollection(colPath) {
  const items = [];
  let pageToken = null;
  do {
    let url = `${BASE_URL}/${colPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const data = await request('GET', url);
    if (data.documents) data.documents.forEach(d => items.push(decodeDocument(d)));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return items;
}

async function setDoc(docPath, data) {
  const fields = encodeFields(data);
  const result = await request('PATCH', `${BASE_URL}/${docPath}`, { fields });
  return decodeDocument(result);
}

async function deleteDoc(docPath) {
  await request('DELETE', `${BASE_URL}/${docPath}`);
  return { deleted: docPath };
}

// ─── "read" command — dump everything to data/ ───

function getISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function writeFile(name, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function readAll() {
  const results = { read: [], failed: [] };
  const ok = (label, detail) => { results.read.push(label); console.error(`  ✅ ${label}: ${detail}`); };
  const fail = (label, err) => { results.failed.push(label); console.error(`  ⚠️  ${label}: ${err}`); };

  console.error('🔑 Authenticating with service account...');
  await getAccessToken(); // warm up
  console.error('  ✅ Authenticated\n');

  // ── Story Map ──
  console.error('── Story Map ──');
  try {
    const sm = await getDoc(`${PUBLIC_DATA}/story-map/main`);
    if (sm) {
      writeFile('story-map.json', sm);
      const acts = sm.activities?.length ?? '?';
      const tasks = sm.tasks?.length ?? '?';
      const slices = sm.slices?.length ?? '?';
      ok('Story map', `${acts} activities, ${tasks} tasks, ${slices} slices`);
    } else {
      throw new Error('Document empty');
    }
  } catch (e) {
    fail('Story map', e.message);
  }

  // ── Backlog ──
  console.error('\n── Backlog ──');
  try {
    const items = await listCollection(`${PUBLIC_DATA}/backlog`);
    writeFile('backlog.json', items);
    ok('Backlog', `${items.length} items`);
  } catch (e) { fail('Backlog', e.message); }

  // ── Feedback ──
  console.error('\n── Feedback ──');
  try {
    const fb = await listCollection(`${PUBLIC_DATA}/feedback`);
    writeFile('feedback.json', fb);
    ok('Feedback', `${fb.length} items`);
  } catch (e) { fail('Feedback', e.message); }

  // ── Fighter data ──
  const week = getISOWeek();
  console.error(`\n── Fighter Data (week ${week}) ──`);
  const fighters = {};
  for (const name of FIGHTERS) {
    fighters[name] = { currentWeek: null, standardTemplate: null };
    try {
      fighters[name].currentWeek = await getDoc(`${USERS_ROOT}/${name}/weeks/week_${week}`);
    } catch (e) { /* may not exist */ }
    try {
      fighters[name].standardTemplate = await getDoc(`${USERS_ROOT}/${name}/templates/standard`);
    } catch (e) { /* may not exist */ }

    const hasWeek = fighters[name].currentWeek ? '✅ week' : '– no week';
    const hasTmpl = fighters[name].standardTemplate ? '✅ template' : '– no template';
    console.error(`  ${name}: ${hasWeek}, ${hasTmpl}`);
  }
  writeFile('fighters.json', fighters);
  ok('Fighters', `${FIGHTERS.length} fighters, week ${week}`);

  // ── Summary ──
  console.error('\n══════════════════════════════');
  console.error(`✅ Read: ${results.read.join(', ')}`);
  if (results.failed.length) console.error(`⚠️  Failed: ${results.failed.join(', ')}`);
  console.error(`📁 Files in: ${OUT_DIR}/`);
  console.error('══════════════════════════════\n');
}

// ─── CLI ───
async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'read':
      await readAll();
      break;

    case 'get': {
      if (!args[0]) { console.error('Usage: node firestore.cjs get <docPath>'); process.exit(1); }
      const doc = await getDoc(args[0]);
      console.log(JSON.stringify(doc, null, 2));
      break;
    }

    case 'list': {
      if (!args[0]) { console.error('Usage: node firestore.cjs list <collectionPath>'); process.exit(1); }
      const docs = await listCollection(args[0]);
      console.log(JSON.stringify(docs, null, 2));
      break;
    }

    case 'set': {
      if (!args[0] || !args[1]) {
        console.error('Usage: node firestore.cjs set <docPath> <jsonFile>');
        process.exit(1);
      }
      const data = JSON.parse(fs.readFileSync(args[1], 'utf8'));
      const result = await setDoc(args[0], data);
      console.log(JSON.stringify(result, null, 2));
      console.error(`✅ Written: ${args[0]}`);
      break;
    }

    case 'delete': {
      if (!args[0]) { console.error('Usage: node firestore.cjs delete <docPath>'); process.exit(1); }
      const result = await deleteDoc(args[0]);
      console.log(JSON.stringify(result, null, 2));
      console.error(`✅ Deleted: ${args[0]}`);
      break;
    }

    default:
      console.error(`
FightWeek Firestore CLI — AI Agent data access

Commands:
  read                          Read all data to data/ folder
  get  <docPath>                Read a single document
  list <collectionPath>         List all documents in a collection
  set  <docPath> <jsonFile>     Write a document from a JSON file
  delete <docPath>              Delete a document

Paths:
  Story map:    ${PUBLIC_DATA}/story-map/main
  Backlog:      ${PUBLIC_DATA}/backlog
  Feedback:     ${PUBLIC_DATA}/feedback
  Fighter:      ${USERS_ROOT}/{name}/weeks/week_{n}
  Template:     ${USERS_ROOT}/{name}/templates/standard

Examples:
  node scripts/firestore.cjs read
  node scripts/firestore.cjs get ${PUBLIC_DATA}/story-map/main
  node scripts/firestore.cjs list ${PUBLIC_DATA}/backlog
  node scripts/firestore.cjs set ${PUBLIC_DATA}/backlog/item-new data/new-item.json
`);
      process.exit(command ? 1 : 0);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
