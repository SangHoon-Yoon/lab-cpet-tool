// Runs every test: build, simulated files, unit tests, then each browser test in turn.
// Usage: npm test   (or: node test/all.js e2e9 e2e24   to run only some browser tests)
const { execFileSync, spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), only = process.argv.slice(2);
require('./paths'); // stops early with a clear message if the sample folder is missing
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 600000 });
const say = s => process.stdout.write(s + '\n');
let failed = [];
if (!only.length) {
  say('Building…'); execFileSync('python3', ['build.py'], { cwd: root, stdio: 'ignore' });
  say('Making simulated test files…'); const fx = run('node', ['test/fixtures.js']); if (fx.status) { say(fx.stdout + fx.stderr); process.exit(1); }
  for (const t of ['run', 'lactate']) { const r = run('node', ['test/' + t + '.js']), last = (r.stdout || '').trim().split('\n').pop();
    say(`${t.padEnd(8)} ${r.status ? 'FAILED' : 'ok'}  ${last || ''}`); if (r.status) failed.push(t); }
}
const e2e = only.length ? only : fs.readdirSync(__dirname).filter(f => /^e2e\d*\.js$/.test(f)).map(f => f.slice(0, -3)).sort((a, b) => (+a.slice(3) || 1) - (+b.slice(3) || 1));
for (const t of e2e) {
  const r = run('node', ['test/' + t + '.js']), out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0 || /FAIL|Error|Timeout/.test(out.replace(/errors: none/g, '')) && !/all passed/.test(out);
  say(`${t.padEnd(8)} ${bad ? 'FAILED' : 'ok'}`); if (bad) { failed.push(t); say(out.split('\n').filter(l => /FAIL|Error|Timeout|errors:/.test(l) && !/errors: none/.test(l)).slice(0, 8).join('\n')); }
}
say(failed.length ? '\nFailed: ' + failed.join(', ') : '\nAll tests passed.');
process.exit(failed.length ? 1 : 0);
