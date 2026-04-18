const fs = require('fs');
const f = 'c:/Users/ruab1206/OneDrive - DSB/art-tools/fightweek-app/src/App.tsx';
let buf = fs.readFileSync(f);
// Remove BOM if present
if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) buf = buf.slice(3);
let text = buf.toString('utf8');

// Fix double-encoded UTF-8 (PowerShell Set-Content damage)
// Map of double-encoded byte sequences to correct characters
const replacements = [
  ['\u00C3\u00B8', '\u00F8'],   // ø
  ['\u00C3\u00A6', '\u00E6'],   // æ
  ['\u00C3\u00A5', '\u00E5'],   // å
  ['\u00C3\u0098', '\u00D8'],   // Ø
  ['\u00C3\u0086', '\u00C6'],   // Æ
  ['\u00C3\u0085', '\u00C5'],   // Å
  ['\u00C3\u00A9', '\u00E9'],   // é
  ['\u00E2\u0080\u0094', '\u2014'], // —
  ['\u00E2\u0080\u0093', '\u2013'], // –
  ['\u00E2\u0080\u0099', '\u2019'], // '
  ['\u00E2\u0080\u009C', '\u201C'], // "
  ['\u00E2\u0080\u009D', '\u201D'], // "
  ['\u00E2\u0086\u0092', '\u2192'], // →
  ['\u00C2\u00B7', '\u00B7'],   // ·
];

let count = 0;
for (const [bad, good] of replacements) {
  const before = text.length;
  text = text.split(bad).join(good);
  const diff = (before - text.length) / (bad.length - good.length);
  if (diff > 0) { console.log(`Fixed ${diff}x: ${good}`); count += diff; }
}

fs.writeFileSync(f, text, 'utf8');
console.log(`\nTotal fixes: ${count}`);
console.log('Lines:', text.split('\n').length);
