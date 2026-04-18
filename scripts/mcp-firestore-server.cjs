/**
 * FightWeek Firestore MCP Server
 *
 * Exposes the FightWeek Firestore database to AI agents via the
 * Model Context Protocol (MCP) over stdio.
 *
 * Tools provided:
 *   - firestore_read_doc        Read a single document
 *   - firestore_list_collection List all documents in a collection
 *   - firestore_write_doc       Create or overwrite a document
 *   - firestore_update_doc      Merge-update specific fields
 *   - firestore_delete_doc      Delete a document
 *   - firestore_add_doc         Add a document with auto-generated ID
 *   - firestore_query           Run a structured query
 *   - fightweek_read_all        Read all FightWeek data (story map, backlog, feedback, fighters)
 *
 * Prerequisites:
 *   serviceAccountKey.json in the fightweek-app/ root
 *
 * Usage (VS Code MCP config):
 *   { "command": "node", "args": ["scripts/mcp-firestore-server.cjs"] }
 */

const db = require('./firestore-admin.cjs');

// ── MCP Protocol (JSON-RPC over stdio) ──

const JSONRPC_VERSION = '2.0';
const MCP_PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = {
  name: 'fightweek-firestore',
  version: '1.0.0',
};

const SERVER_CAPABILITIES = {
  tools: {},
};

// ── Tool definitions ──

const FIGHTERS = ['Caroline', 'San', 'Enea', 'Anton', 'Jonas', 'Karl'];

function getISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const TOOLS = [
  {
    name: 'firestore_read_doc',
    description: 'Read a single Firestore document by its full path. Common paths: story-map = "artifacts/production/public/data/story-map/main", backlog item = "artifacts/production/public/data/backlog/{id}", fighter week = "artifacts/production/users/{Name}/weeks/week_{N}", fighter template = "artifacts/production/users/{Name}/templates/standard". Fighters: Caroline, San, Enea, Anton, Jonas, Karl.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full Firestore document path, e.g. "artifacts/production/public/data/story-map/main"',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'firestore_list_collection',
    description: 'List all documents in a Firestore collection. Common collections: backlog = "artifacts/production/public/data/backlog", feedback = "artifacts/production/public/data/feedback", fighter weeks = "artifacts/production/users/{Name}/weeks".',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full Firestore collection path, e.g. "artifacts/production/public/data/backlog"',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'firestore_write_doc',
    description: 'Create or overwrite a Firestore document at a specific path. Use for creating new backlog items, updating story map data, writing fighter schedules, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full Firestore document path',
        },
        data: {
          type: 'object',
          description: 'The document data to write (plain JSON object)',
        },
      },
      required: ['path', 'data'],
    },
  },
  {
    name: 'firestore_update_doc',
    description: 'Merge-update specific fields on an existing Firestore document without overwriting other fields.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full Firestore document path',
        },
        fields: {
          type: 'object',
          description: 'Only the fields to update (will be merged with existing document)',
        },
      },
      required: ['path', 'fields'],
    },
  },
  {
    name: 'firestore_delete_doc',
    description: 'Delete a Firestore document.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full Firestore document path to delete',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'firestore_add_doc',
    description: 'Add a new document to a Firestore collection with an auto-generated ID. Returns the created document including its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Full Firestore collection path, e.g. "artifacts/production/public/data/backlog"',
        },
        data: {
          type: 'object',
          description: 'The document data to write',
        },
      },
      required: ['collection', 'data'],
    },
  },
  {
    name: 'firestore_query',
    description: 'Run a structured query against a Firestore collection. Supports filtering by a single field, ordering, and limiting results.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPath: {
          type: 'string',
          description: 'Parent document path, e.g. "artifacts/production/public/data"',
        },
        collectionId: {
          type: 'string',
          description: 'Collection name, e.g. "backlog"',
        },
        field: {
          type: 'string',
          description: 'Field to filter on (optional)',
        },
        op: {
          type: 'string',
          description: 'Filter operator: EQUAL, NOT_EQUAL, LESS_THAN, GREATER_THAN, ARRAY_CONTAINS, IN (optional, default: EQUAL)',
        },
        value: {
          description: 'Value to compare against (optional, required if field is set)',
        },
        orderBy: {
          type: 'string',
          description: 'Field to order results by (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (optional)',
        },
      },
      required: ['parentPath', 'collectionId'],
    },
  },
  {
    name: 'fightweek_read_all',
    description: 'Read all FightWeek data in one call: story map, backlog items, feedback, and fighter schedules for the current week. Returns a comprehensive snapshot of the entire app state. Use this at the start of planning/review sessions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ── Tool handlers ──

async function handleTool(name, args) {
  switch (name) {
    case 'firestore_read_doc': {
      const doc = await db.readDoc(args.path);
      if (doc === null) return { content: [{ type: 'text', text: `Document not found: ${args.path}` }] };
      return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
    }

    case 'firestore_list_collection': {
      const items = await db.listCollection(args.path);
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    }

    case 'firestore_write_doc': {
      await db.writeDoc(args.path, args.data);
      return { content: [{ type: 'text', text: `Document written: ${args.path}` }] };
    }

    case 'firestore_update_doc': {
      await db.updateDoc(args.path, args.fields);
      return { content: [{ type: 'text', text: `Document updated: ${args.path}` }] };
    }

    case 'firestore_delete_doc': {
      await db.deleteDoc(args.path);
      return { content: [{ type: 'text', text: `Document deleted: ${args.path}` }] };
    }

    case 'firestore_add_doc': {
      const created = await db.addDoc(args.collection, args.data);
      return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
    }

    case 'firestore_query': {
      const opts = {};
      if (args.field) opts.where = { field: args.field, op: args.op || 'EQUAL', value: args.value };
      if (args.orderBy) opts.orderBy = args.orderBy;
      if (args.limit) opts.limit = args.limit;
      const results = await db.query(args.parentPath, args.collectionId, opts);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }

    case 'fightweek_read_all': {
      const week = getISOWeek();
      const snapshot = { _meta: { readAt: new Date().toISOString(), week } };

      // Story map
      try {
        snapshot.storyMap = await db.readDoc(db.PATHS.storyMap);
      } catch (e) { snapshot.storyMap = { _error: e.message }; }

      // Backlog
      try {
        snapshot.backlog = await db.listCollection(db.PATHS.backlog);
      } catch (e) { snapshot.backlog = { _error: e.message }; }

      // Feedback
      try {
        snapshot.feedback = await db.listCollection(db.PATHS.feedback);
      } catch (e) { snapshot.feedback = { _error: e.message }; }

      // Fighters
      snapshot.fighters = {};
      for (const name of FIGHTERS) {
        snapshot.fighters[name] = {};
        try {
          snapshot.fighters[name].currentWeek = await db.readDoc(db.PATHS.userWeek(name, week));
        } catch (e) { /* may not exist */ }
        try {
          snapshot.fighters[name].standardTemplate = await db.readDoc(db.PATHS.userTemplate(name));
        } catch (e) { /* may not exist */ }
      }

      return { content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }] };
    }

    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}

// ── JSON-RPC message handling ──

let initialized = false;

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      initialized = true;
      return {
        jsonrpc: JSONRPC_VERSION,
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: SERVER_CAPABILITIES,
          serverInfo: SERVER_INFO,
        },
      };

    case 'notifications/initialized':
      // Client acknowledging init — no response needed
      return null;

    case 'tools/list':
      return {
        jsonrpc: JSONRPC_VERSION,
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const result = await handleTool(name, args || {});
        return { jsonrpc: JSONRPC_VERSION, id, result };
      } catch (e) {
        const code = e.code || -32603;
        const message = e.message || String(e);
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          },
        };
      }
    }

    case 'ping':
      return { jsonrpc: JSONRPC_VERSION, id, result: {} };

    default:
      // Unknown method — if it has an id, return method not found
      if (id !== undefined) {
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
      // Notifications we don't handle — ignore
      return null;
  }
}

// ── stdio transport ──

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;

  // Process all complete messages in the buffer
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      // Bad header — skip to after the double newline
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) break; // wait for more data

    const body = buffer.slice(bodyStart, bodyStart + contentLength);
    buffer = buffer.slice(bodyStart + contentLength);

    let msg;
    try {
      msg = JSON.parse(body);
    } catch (e) {
      log(`Failed to parse JSON: ${e.message}`);
      continue;
    }

    handleMessage(msg).then((response) => {
      if (response) send(response);
    }).catch((e) => {
      log(`Handler error: ${e.message}`);
      if (msg.id !== undefined) {
        send({
          jsonrpc: JSONRPC_VERSION,
          id: msg.id,
          error: { code: -32603, message: e.message },
        });
      }
    });
  }
});

function send(msg) {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  process.stdout.write(header + body);
}

function log(msg) {
  process.stderr.write(`[fightweek-mcp] ${msg}\n`);
}

// ── Startup ──

async function startup() {
  try {
    await db.init();
    log('Service account authenticated — MCP server ready');
  } catch (e) {
    log(`Failed to authenticate: ${e.message}`);
    process.exit(1);
  }
}

startup();
