import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Personal data must never reach tracked (public) files.
const FORBIDDEN = ['高宮', 'takamiya', 'ブルーベース', 'blue-base', 'bluebase', '175cm', '75kg', 'icloud.com'];
const SELF = 'tests/privacy.test.mjs';

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' });
  return out.split('\n').filter((f) => f && f !== SELF);
}

test('tracked files contain no personal data', () => {
  const hits = [];
  for (const f of trackedFiles()) {
    let text;
    try { text = readFileSync(f, 'utf8').toLowerCase(); } catch { continue; }
    for (const word of FORBIDDEN) if (text.includes(word.toLowerCase())) hits.push(`${f}: ${word}`);
  }
  assert.deepEqual(hits, []);
});

test('private/ is ignored', () => {
  const lines = readFileSync('.gitignore', 'utf8').split(/\r?\n/);
  assert.ok(lines.includes('private/'));
});

test('no tracked code or config names the owner', () => {
  const hits = trackedFiles().filter((f) => !f.startsWith('docs/data/')).filter((f) => {
    try { return /\bkai\b/i.test(readFileSync(f, 'utf8')); } catch { return false; }
  });
  assert.deepEqual(hits, []);
});

test('the site asks search engines not to list it', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync('docs/index.html', 'utf8'), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(readFileSync('docs/robots.txt', 'utf8'), /User-agent: \*\s+Disallow: \//);
});
