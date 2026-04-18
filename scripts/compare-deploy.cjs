const { execSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join, relative } = require('path');

function walk(dir) {
  let files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) && !/\.bak$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

const root = process.cwd();
const files = walk(join(root, 'src'));
const diffs = [];
const news = [];
let okCount = 0;

for (const abs of files) {
  const rel = relative(root, abs).replace(/\\/g, '/');
  try {
    const localHash = execSync(`git hash-object "${rel}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const remoteHash = execSync(`git rev-parse "origin/main:${rel}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (localHash === remoteHash) {
      okCount++;
    } else {
      diffs.push(rel);
    }
  } catch {
    news.push(rel);
  }
}

const lines = [];
lines.push(`DIFFERENT from GitHub (${diffs.length}):`);
diffs.forEach(f => lines.push(`  ${f}`));
lines.push(`NEW - not on GitHub (${news.length}):`);
news.forEach(f => lines.push(`  ${f}`));
lines.push(`Identical: ${okCount}`);
lines.push(`Total to sync: ${diffs.length + news.length} files`);
require('fs').writeFileSync(require('path').join(__dirname, '..', '_compare-result.txt'), lines.join('\n'));
console.log('Compare done - see _compare-result.txt');
