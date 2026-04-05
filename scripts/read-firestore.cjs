/**
 * Read story map + backlog from Firestore REST API and dump to local JSON files.
 * Run with: node scripts/read-firestore.cjs
 *
 * Uses the Firestore REST API — no SDK dependency issues with Node 16.
 * This gives the AI agent access to story map data during planning sessions.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'fightweek-app';
const API_KEY = 'AIzaSyDdOsNxPtlvWBP3SmNOxo1JfVXV9KeGUVA';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PUBLIC_DATA = 'artifacts/production/public/data';
const OUT_DIR = path.join(__dirname, '..', 'data');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Auth: get ID token via anonymous sign-in or email/password ──
function signInAnonymously() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ returnSecureToken: true });
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signUp?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`Auth failed: ${data.slice(0, 200)}`));
        else resolve(JSON.parse(data).idToken);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

let authToken = null;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: {} };
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
    https.get(url, opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    }).on('error', reject);
  });
}

/** Convert Firestore REST field values to plain JS values */
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
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = decodeValue(v);
  }
  return obj;
}

function decodeDocument(doc) {
  const name = doc.name.split('/').pop();
  return { id: name, ...decodeFields(doc.fields || {}) };
}

async function readDocument(path) {
  const url = `${BASE}/${path}`;
  console.log(`  GET ${path}`);
  const data = await fetchJSON(url);
  if (data.fields) return decodeFields(data.fields);
  return null;
}

async function readCollection(colPath) {
  const items = [];
  let pageToken = null;
  do {
    let url = `${BASE}/${colPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    console.log(`  GET ${colPath}${pageToken ? ' (next page)' : ''}`);
    const data = await fetchJSON(url);
    if (data.documents) {
      for (const doc of data.documents) {
        items.push(decodeDocument(doc));
      }
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return items;
}

async function main() {
  console.log('Authenticating...');
  try {
    authToken = await signInAnonymously();
    console.log('  ✅ Got auth token\n');
  } catch (e) {
    console.log(`  ⚠️  Anonymous auth failed (${e.message}), trying unauthenticated...\n`);
  }

  console.log('Reading from Firestore REST API...\n');

  // 0. List story-map sub-collection to find correct doc name
  try {
    const smDocs = await readCollection(`${PUBLIC_DATA}/story-map`);
    console.log(`  📂 story-map collection: ${smDocs.length} documents: ${smDocs.map(d => d.id).join(', ')}\n`);
  } catch (e) {
    console.log(`  ⚠️  story-map listing: ${e.message}\n`);
  }

  // 1. Story map document
  try {
    const storyMap = await readDocument(`${PUBLIC_DATA}/story-map/main`);
    if (storyMap) {
      fs.writeFileSync(path.join(OUT_DIR, 'story-map.json'), JSON.stringify(storyMap, null, 2));
      console.log(`  ✅ Story map: ${storyMap.activities?.length ?? 0} activities, ${storyMap.tasks?.length ?? 0} tasks, ${storyMap.slices?.length ?? 0} slices, ${storyMap.personas?.length ?? 0} personas\n`);
    } else {
      console.log('  ⚠️  No story map found\n');
    }
  } catch (e) {
    console.log(`  ⚠️  Story map: ${e.message}\n`);
  }

  // 2. Backlog items (collection of individual documents)
  try {
    const items = await readCollection(`${PUBLIC_DATA}/backlog`);
    fs.writeFileSync(path.join(OUT_DIR, 'backlog.json'), JSON.stringify(items, null, 2));
    console.log(`  ✅ Backlog: ${items.length} items\n`);
  } catch (e) {
    console.log(`  ⚠️  Backlog: ${e.message}\n`);
  }

  // 3. Feedback
  try {
    const fb = await readCollection(`${PUBLIC_DATA}/feedback`);
    fs.writeFileSync(path.join(OUT_DIR, 'feedback.json'), JSON.stringify(fb, null, 2));
    console.log(`  ✅ Feedback: ${fb.length} items\n`);
  } catch (e) {
    console.log(`  ⚠️  Feedback: ${e.message}\n`);
  }

  console.log(`Files written to ${OUT_DIR}/`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
