const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'js', '__tests__');
const timeoutMs = Math.max(15000, Number(process.env.S3_TEST_FILE_TIMEOUT_MS || 45000));
const concurrency = Math.max(1, Math.min(4, Number(process.env.S3_TEST_CONCURRENCY || 2)));
const maxOldSpaceMb = Math.max(384, Math.min(1536, Number(process.env.S3_TEST_MAX_OLD_SPACE_MB || 768)));
const allFiles = fs.readdirSync(testsDir)
  .filter(name => name.endsWith('.test.js') || name.endsWith('.test.mjs'))
  .sort();
const supersededManifestPath = path.join(root, 'QA', 'S3_SUPERSEDED_TESTS.json');
const supersededManifest = JSON.parse(fs.readFileSync(supersededManifestPath, 'utf8'));
const supersededEntries = Array.isArray(supersededManifest.entries) ? supersededManifest.entries : [];
const supersededFiles = new Set(supersededEntries.map(entry => String(entry.file || '')));
for (const entry of supersededEntries) {
  if (!entry.file || !allFiles.includes(entry.file)) throw new Error(`Superseded test missing: ${entry.file || '<empty>'}`);
  const replacements = String(entry.supersededBy || '').split('+').map(x => x.trim()).filter(Boolean);
  if (!replacements.length) throw new Error(`Superseded test without replacement: ${entry.file}`);
  for (const replacement of replacements) {
    if (!allFiles.includes(replacement)) throw new Error(`Superseded replacement missing: ${entry.file} -> ${replacement}`);
    if (supersededFiles.has(replacement)) throw new Error(`Superseded replacement is itself archived: ${entry.file} -> ${replacement}`);
  }
}
const files = allFiles.filter(name => !supersededFiles.has(name));
const isTimingSensitive = (name) => {
  if (/(?:performance|perf|stress|bulk|fuzz|load)/i.test(name)) return true;
  const source = fs.readFileSync(path.join(testsDir, name), 'utf8');
  return /performance\.now\(|process\.hrtime|hrtime\.bigint/.test(source);
};
const timingFiles = files.filter(isTimingSensitive);
const functionalFiles = files.filter(name => !timingFiles.includes(name));
const requestedPhase = String(process.env.S3_TEST_PHASE || 'all').toLowerCase();
if (!['all','functional','timing'].includes(requestedPhase)) throw new Error(`Invalid S3_TEST_PHASE: ${requestedPhase}`);
const shardTotal = Math.max(1, Number(process.env.S3_TEST_SHARD_TOTAL || 1));
const shardIndex = Number(process.env.S3_TEST_SHARD_INDEX || 0);
if (!Number.isInteger(shardTotal) || shardTotal < 1) throw new Error(`Invalid S3_TEST_SHARD_TOTAL: ${process.env.S3_TEST_SHARD_TOTAL}`);
if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardTotal) throw new Error(`Invalid S3_TEST_SHARD_INDEX: ${process.env.S3_TEST_SHARD_INDEX}`);
const shard = (list) => shardTotal === 1 ? list : list.filter((_, index) => index % shardTotal === shardIndex);
const selectedFunctionalFiles = requestedPhase === 'timing' ? [] : shard(functionalFiles);
const selectedTimingFiles = requestedPhase === 'functional' ? [] : shard(timingFiles);
const selectedFileCount = selectedFunctionalFiles.length + selectedTimingFiles.length;

const started = Date.now();
let passed = 0;
let failed = false;
const active = new Set();

function killProcessTree(child, signal = 'SIGTERM') {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      // node --test may own a child process for the actual test file. taskkill /T
      // closes the complete tree so a grandchild cannot keep stdout/stderr open.
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
      return;
    }
    // Each file runner is a process-group leader on POSIX (detached:true below).
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already gone */ }
  }
}

function runOne(name) {
  return new Promise((resolve) => {
    const rel = path.join('js', '__tests__', name);
    const child = spawn(process.execPath, [`--max-old-space-size=${maxOldSpaceMb}`, '--test', '--test-reporter=dot', rel], {
      cwd: root,
      env: { ...process.env, TERM: process.env.TERM || 'dumb' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    active.add(child);

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let forceTimer = null;
    let resolveTimer = null;
    const append = (current, chunk) => {
      const next = current + chunk.toString();
      return next.length > 12000 ? next.slice(-12000) : next;
    };
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      if (resolveTimer) clearTimeout(resolveTimer);
      active.delete(child);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child, 'SIGTERM');
      forceTimer = setTimeout(() => killProcessTree(child, 'SIGKILL'), 1500);
      // The process group has already been force-killed. Never let an inherited
      // pipe from a broken test wedge the release gate itself.
      resolveTimer = setTimeout(() => finish({
        ok: false, name, timedOut: true, stdout, stderr,
        code: child.exitCode, signal: child.signalCode || 'SIGKILL_TREE',
      }), 4000);
    }, timeoutMs);

    child.on('error', error => finish({ ok: false, name, timedOut, stdout, stderr, error }));
    child.on('close', (code, signal) => finish({
      ok: !timedOut && code === 0,
      name,
      timedOut,
      stdout,
      stderr,
      code,
      signal,
    }));
  });
}

function reportFailure(result) {
  if (failed) return;
  failed = true;
  console.error(`\n[S3 QA] FAIL ${result.name}${result.timedOut ? ` (timeout ${timeoutMs} ms)` : ''}`);
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.error) console.error(result.error);
  else console.error(`[S3 QA] exit=${result.code} signal=${result.signal || 'none'}`);
  for (const child of active) killProcessTree(child, 'SIGKILL');
}

async function runBatch(batchFiles, batchConcurrency, label) {
  let cursor = 0;
  console.log(`[S3 QA] phase=${label} | fichiers=${batchFiles.length} | concurrence=${batchConcurrency}`);
  async function worker() {
    while (!failed) {
      const index = cursor++;
      if (index >= batchFiles.length) return;
      const result = await runOne(batchFiles[index]);
      if (!result.ok) {
        reportFailure(result);
        return;
      }
      passed++;
      if (passed === 1 || passed % 20 === 0 || passed === selectedFileCount) {
        console.log(`[S3 QA] ${passed}/${selectedFileCount} fichiers verts`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(batchConcurrency, batchFiles.length || 1) }, () => worker()));
}

(async () => {
  console.log(`[S3 QA] phase demandée=${requestedPhase} | ${files.length} fichiers actifs + ${supersededFiles.size} archives supersédées | sélection=${selectedFileCount} | shard=${shardIndex + 1}/${shardTotal} | isolation processus | timeout=${timeoutMs}ms | max-old-space=${maxOldSpaceMb}MB`);
  console.log(`[S3 QA] politique timing: ${timingFiles.length} fichier(s) exécuté(s) seuls après la phase fonctionnelle`);
  if (selectedFunctionalFiles.length) await runBatch(selectedFunctionalFiles, concurrency, 'functional');
  if (!failed && selectedTimingFiles.length) await runBatch(selectedTimingFiles, 1, 'timing-serial');
  const report = {
    ok: !failed && passed === selectedFileCount,
    phase: requestedPhase,
    files: selectedFileCount,
    totalActiveFiles: files.length,
    archivedSupersededFiles: supersededFiles.size,
    discoveredFiles: allFiles.length,
    functionalFiles: functionalFiles.length,
    timingFiles: timingFiles.length,
    passed,
    failed: failed ? 1 : 0,
    timeoutMs,
    maxOldSpaceMb,
    functionalConcurrency: concurrency,
    timingConcurrency: 1,
    processIsolation: 'one-node-process-group-per-test-file',
    shardIndex,
    shardTotal,
    timingIsolation: 'serial-after-functional-suite',
    networkPolicy: 'tests must mock external HTTP paths',
    durationMs: Date.now() - started,
  };
  console.log(JSON.stringify(report));
  if (!report.ok) process.exit(1);
})().catch(error => {
  for (const child of active) killProcessTree(child, 'SIGKILL');
  console.error(error);
  process.exit(1);
});
