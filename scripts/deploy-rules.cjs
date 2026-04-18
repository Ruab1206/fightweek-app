#!/usr/bin/env node
/**
 * deploy-rules.cjs — Deploy Firestore security rules via REST API.
 *
 * Reads firestore.rules from the repo root and deploys to Firebase.
 * Uses the service account key for authentication (same as firestore-admin.cjs).
 *
 * Usage:
 *   node scripts/deploy-rules.cjs           # deploy rules
 *   node scripts/deploy-rules.cjs --dry-run # show rules without deploying
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'fightweek-app';
const RULES_FILE = path.join(__dirname, '..', 'firestore.rules');
const SCOPES = 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let serviceAccount = null;
let accessToken = null;

function loadKey() {
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.error('❌ serviceAccountKey.json not found');
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(serviceAccount.private_key, 'base64url');
  return `${header}.${payload}.${sig}`;
}

function getToken() {
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${createJWT()}`;
    const req = https.request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpRequest(url, method, token, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rulesSource = fs.readFileSync(RULES_FILE, 'utf8');

  console.log(`Rules file: ${RULES_FILE}`);
  console.log(`Rules length: ${rulesSource.length} chars, ${rulesSource.split('\n').length} lines`);

  if (dryRun) {
    console.log('\nDRY RUN — rules content:');
    console.log(rulesSource);
    return;
  }

  loadKey();
  accessToken = await getToken();

  // Deploy via Firebase Rules API
  const url = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`;

  const payload = JSON.stringify({
    source: {
      files: [{
        name: 'firestore.rules',
        content: rulesSource,
      }],
    },
  });

  console.log('Creating ruleset...');
  const createResult = await httpRequest(url, 'POST', accessToken, payload);

  if (createResult.status !== 200) {
    console.error('❌ Failed to create ruleset:', JSON.stringify(createResult.data, null, 2));
    process.exit(1);
  }

  const rulesetName = createResult.data.name;
  console.log(`  Ruleset created: ${rulesetName}`);

  // Release the ruleset to the default database
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`;
  const releasePayload = JSON.stringify({
    release: {
      name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
      rulesetName: rulesetName,
    },
  });

  console.log('Releasing to cloud.firestore...');
  const releaseResult = await httpRequest(releaseUrl, 'PATCH', accessToken, releasePayload);

  if (releaseResult.status === 200) {
    console.log('✅ Security rules deployed successfully!');
  } else {
    console.error('❌ Failed to release ruleset:', JSON.stringify(releaseResult.data, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
