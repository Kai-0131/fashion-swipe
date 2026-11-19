import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const fetchYml = readFileSync('.github/workflows/fetch.yml', 'utf8');
const all = readdirSync('.github/workflows').map((f) => readFileSync(`.github/workflows/${f}`, 'utf8'));

test('fetch.yml has workflow_dispatch and no schedule yet', () => {
  assert.match(fetchYml, /workflow_dispatch:/);
  assert.doesNotMatch(fetchYml, /schedule:/);
});

test('fetch.yml checks FETCH_ENABLED', () => {
  assert.match(fetchYml, /vars\.FETCH_ENABLED == 'true'/);
  assert.match(fetchYml, /FETCH_ENABLED: \$\{\{ vars\.FETCH_ENABLED \}\}/);
});

test('fetch.yml has timeout-minutes: 15 and concurrency', () => {
  assert.match(fetchYml, /timeout-minutes: 15/);
  assert.match(fetchYml, /concurrency:/);
  assert.match(fetchYml, /cancel-in-progress: false/);
});

test('fetch.yml runs npm test before fetching', () => {
  assert.ok(fetchYml.indexOf('npm test') > 0);
  assert.ok(fetchYml.indexOf('npm test') < fetchYml.indexOf('node pipeline/run.mjs'));
});

test('no workflow uses larger runners', () => {
  for (const y of all) for (const m of y.matchAll(/runs-on:\s*(\S+)/g)) assert.equal(m[1], 'ubuntu-latest');
});

test('fetch.yml only pushes to main', () => {
  assert.match(fetchYml, /git push origin HEAD:main/);
  assert.equal((fetchYml.match(/git push/g) || []).length, 1);
});

test('secrets are only passed as env, never echoed', () => {
  for (const y of all) assert.doesNotMatch(y, /echo .*secrets\./);
});

test('fetch.yml uses node 22 or newer (node --test globs need 21+)', () => {
  const v = Number((fetchYml.match(/node-version:\s*(\d+)/) || [])[1]);
  assert.ok(v >= 22, `node-version ${v}`);
});

test('fetch job only runs on main', () => {
  assert.match(fetchYml, /github\.ref == 'refs\/heads\/main'/);
});
