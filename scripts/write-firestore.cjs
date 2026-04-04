/**
 * write-firestore.cjs — Write data to Firestore from the command line.
 *
 * Usage:
 *   node scripts/write-firestore.cjs <command> <path> [json-data]
 *
 * Commands:
 *   read   <path>              Read a document
 *   list   <collection-path>   List documents in a collection
 *   write  <path> <json>       Create or overwrite a document
 *   update <path> <json>       Merge-update fields on a document
 *   delete <path>              Delete a document
 *   add    <collection> <json> Add a document with auto-ID
 *
 * Examples:
 *   node scripts/write-firestore.cjs read artifacts/production/public/data/story-map/main
 *   node scripts/write-firestore.cjs list artifacts/production/public/data/backlog
 *   node scripts/write-firestore.cjs write artifacts/production/public/data/backlog/item123 '{"title":"New item","status":"todo"}'
 *   node scripts/write-firestore.cjs update artifacts/production/public/data/backlog/item123 '{"status":"done"}'
 *   node scripts/write-firestore.cjs delete artifacts/production/public/data/backlog/item123
 *   node scripts/write-firestore.cjs add artifacts/production/public/data/backlog '{"title":"New item"}'
 */

const db = require('./firestore-admin.cjs');

const [,, command, docPath, jsonArg] = process.argv;

if (!command || !docPath) {
  console.error('Usage: node scripts/write-firestore.cjs <command> <path> [json-data]');
  console.error('Commands: read, list, write, update, delete, add');
  process.exit(1);
}

function parseData() {
  if (!jsonArg) {
    console.error('Error: JSON data argument required for this command');
    process.exit(1);
  }
  try {
    return JSON.parse(jsonArg);
  } catch (e) {
    console.error(`Error: Invalid JSON — ${e.message}`);
    process.exit(1);
  }
}

async function main() {
  await db.init();

  switch (command) {
    case 'read': {
      const doc = await db.readDoc(docPath);
      if (doc === null) { console.log('Document not found'); process.exit(1); }
      console.log(JSON.stringify(doc, null, 2));
      break;
    }
    case 'list': {
      const items = await db.listCollection(docPath);
      console.log(JSON.stringify(items, null, 2));
      break;
    }
    case 'write': {
      const data = parseData();
      await db.writeDoc(docPath, data);
      console.log(`✅ Written: ${docPath}`);
      break;
    }
    case 'update': {
      const fields = parseData();
      await db.updateDoc(docPath, fields);
      console.log(`✅ Updated: ${docPath}`);
      break;
    }
    case 'delete': {
      await db.deleteDoc(docPath);
      console.log(`✅ Deleted: ${docPath}`);
      break;
    }
    case 'add': {
      const newData = parseData();
      const created = await db.addDoc(docPath, newData);
      console.log(`✅ Created: ${JSON.stringify(created, null, 2)}`);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
