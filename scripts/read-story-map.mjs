/**
 * Read story map + backlog from Firestore and dump to local JSON files.
 * Run with: node scripts/read-story-map.mjs
 *
 * This gives the AI agent access to the story map data during planning sessions.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'data');
mkdirSync(outDir, { recursive: true });

// Firebase config (same as src/config/firebase.ts)
const app = initializeApp({
  apiKey: "AIzaSyDdOsNxPtlvWBP3SmNOxo1JfVXV9KeGUVA",
  authDomain: "fightweek-app.firebaseapp.com",
  projectId: "fightweek-app",
  storageBucket: "fightweek-app.firebasestorage.app",
  messagingSenderId: "141030861103",
  appId: "1:141030861103:web:962fd2747623b171f159da"
});

const db = getFirestore(app);
const PUBLIC_DATA_PATH = 'artifacts/production/public/data';

async function main() {
  console.log('Reading story map from Firestore...');

  // 1. Story map (single document)
  const mapSnap = await getDoc(doc(db, PUBLIC_DATA_PATH, 'story-map', 'main'));
  if (mapSnap.exists()) {
    const data = mapSnap.data();
    writeFileSync(join(outDir, 'story-map.json'), JSON.stringify(data, null, 2));
    console.log(`✅ Story map: ${data.activities?.length ?? 0} activities, ${data.tasks?.length ?? 0} tasks, ${data.slices?.length ?? 0} slices`);
  } else {
    console.log('⚠️  No story map document found at', `${PUBLIC_DATA_PATH}/story-map/main`);
  }

  // 2. Backlog items (collection)
  const backlogSnap = await getDocs(collection(db, PUBLIC_DATA_PATH, 'backlog'));
  const items = [];
  backlogSnap.forEach(d => items.push({ id: d.id, ...d.data() }));
  writeFileSync(join(outDir, 'backlog.json'), JSON.stringify(items, null, 2));
  console.log(`✅ Backlog: ${items.length} items`);

  // 3. Feedback (collection)
  const fbSnap = await getDocs(collection(db, PUBLIC_DATA_PATH, 'feedback'));
  const feedback = [];
  fbSnap.forEach(d => feedback.push({ id: d.id, ...d.data() }));
  writeFileSync(join(outDir, 'feedback.json'), JSON.stringify(feedback, null, 2));
  console.log(`✅ Feedback: ${feedback.length} items`);

  console.log(`\nFiles written to ${outDir}/`);
  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
