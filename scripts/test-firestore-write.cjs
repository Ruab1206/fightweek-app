/**
 * Test writing a small doc to the story-map path in Firestore.
 * Run: node scripts/test-firestore-write.cjs
 */
const https = require('https');

const API_KEY = 'AIzaSyDdOsNxPtlvWBP3SmNOxo1JfVXV9KeGUVA';
const PROJECT_ID = 'fightweek-app';
const DOC_PATH = 'artifacts/production/public/data/story-map/main';
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${DOC_PATH}`;

function signInAnon() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ returnSecureToken: true });
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signUp?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => res.statusCode >= 400 ? reject(new Error(d.slice(0, 200))) : resolve(JSON.parse(d).idToken));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Authenticating...');
  const token = await signInAnon();
  console.log('✅ Got token\n');

  // Try writing a tiny test document
  const testDoc = {
    fields: {
      _test: { stringValue: 'write-test-' + new Date().toISOString() },
      maps: { arrayValue: { values: [] } },
      activities: { arrayValue: { values: [] } },
      tasks: { arrayValue: { values: [] } },
      slices: { arrayValue: { values: [] } },
    }
  };

  console.log('Writing test doc to', DOC_PATH);
  const body = JSON.stringify(testDoc);

  return new Promise((resolve) => {
    const req = https.request(URL + '?currentDocument.exists=false', {
      method: 'PATCH',   // PATCH = createOrUpdate
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.log(`❌ Write failed (HTTP ${res.statusCode}):`);
          console.log(d.slice(0, 300));
        } else {
          console.log('✅ Write succeeded!');
        }
        resolve();
      });
    });
    req.on('error', e => { console.log('❌ Request error:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

main().catch(e => console.error(e));
