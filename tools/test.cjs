const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.test.js')).sort().map(name => path.join('src', name));
assert.ok(tests.length > 0, 'The simulation test command must discover real test files');
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;