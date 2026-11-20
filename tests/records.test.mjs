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

test('setReason marks color or shape as liked or disliked, and tapping the same again clears it', async () => {
  const { setReason } = await import('../docs/js/records.js');
  let out = setReason(swipes, 'a', 'color', 1);
  assert.deepEqual(out.a.reasons, { color: 1 });
  out = setReason(out, 'a', 'shape', -1);
  assert.deepEqual(out.a.reasons, { color: 1, shape: -1 });
  out = setReason(out, 'a', 'color', -1);
  assert.deepEqual(out.a.reasons, { color: -1, shape: -1 });
  out = setReason(out, 'a', 'shape', -1);
  assert.deepEqual(out.a.reasons, { color: -1 });
  out = setReason(out, 'a', 'color', -1);
  assert.equal(out.a.reasons, undefined, 'no reasons left');
  assert.equal(swipes.a.reasons, undefined, 'input not changed');
  assert.equal(setReason(swipes, 'zz', 'color', 1), swipes);
  assert.throws(() => setReason(swipes, 'a', 'size', 1));
  assert.throws(() => setReason(swipes, 'a', 'color', 2));
});
