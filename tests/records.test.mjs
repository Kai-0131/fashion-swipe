import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setVerdict } from '../docs/js/records.js';

const swipes = { a: { itemId: 'a', kind: 'item', verdict: 'fav', at: '2026-11-19T10:00:00Z', snapshot: { brand: 'X' } } };

test('setVerdict changes a saved record and keeps the rest', () => {
  const out = setVerdict(swipes, 'a', 'meh');
  assert.equal(out.a.verdict, 'meh');
  assert.equal(out.a.at, '2026-11-19T10:00:00Z');
  assert.deepEqual(out.a.snapshot, { brand: 'X' });
  assert.equal(swipes.a.verdict, 'fav', 'input not changed');
});

test('setVerdict with null removes the record', () => {
  assert.deepEqual(setVerdict(swipes, 'a', null), {});
});

test('setVerdict ignores unknown ids and unknown verdicts', () => {
  assert.equal(setVerdict(swipes, 'zz', 'like'), swipes);
  assert.throws(() => setVerdict(swipes, 'a', 'love'));
});
