const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const entries = fs.readFileSync(path.join(root, 'QA/FILE_SHA256_MANIFEST.txt'), 'utf8').trim().split(/\r?\n/);
let checked=0, failed=0;
for (const entry of entries) {
  const m = /^([a-f0-9]{64})  (.+)$/.exec(entry);
  if (!m) { console.error('Malformed manifest entry'); failed++; continue; }
  const target = path.resolve(root, m[2]);
  if (!target.startsWith(root + path.sep)) { console.error('Unsafe path:', m[2]); failed++; continue; }
  try {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (hash !== m[1]) { console.error('HASH MISMATCH:', m[2]); failed++; }
    checked++;
  } catch (e) { console.error('MISSING/UNREADABLE:', m[2], e.message); failed++; }
}
console.log(JSON.stringify({checked, failed, ok: failed === 0}));
process.exitCode = failed ? 1 : 0;
