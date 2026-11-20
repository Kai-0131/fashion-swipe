import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshot } from '../pipeline/merge.mjs';

const NOW = '2026-11-19T11:00:00Z';
const item = (shopId, n) => ({ id: `shopify:${shopId}:${n}`, shopId, title: `${shopId}-${n}` });
const many = (shopId, k) => Array.from({ length: k }, (_, i) => item(shopId, i));
const prevOf = (items) => ({ updatedAt: '2026-11-18T11:00:00Z', items, sources: {} });

test('merge uses new items for ok sources', () => {
  const { snapshot, abort } = mergeSnapshot(prevOf(many('a', 2)), [{ sourceId: 'a', ok: true, items: many('a', 3) }], NOW);
  assert.equal(abort, false);
  assert.equal(snapshot.items.length, 3);
  assert.equal(snapshot.updatedAt, NOW);
  assert.deepEqual(snapshot.sources.a, { ok: true, count: 3 });
});

test('merge keeps previous items for failed source and marks stale', () => {
  const prev = prevOf([...many('a', 2), ...many('b', 2)]);
  const { snapshot } = mergeSnapshot(prev, [
    { sourceId: 'a', ok: true, items: many('a', 2) },
    { sourceId: 'b', ok: false, items: null, error: 'rate_limited' },
  ], NOW);
  assert.equal(snapshot.items.filter((i) => i.shopId === 'b').length, 2);
  assert.deepEqual(snapshot.sources.b, { ok: false, count: 2, error: 'rate_limited', stale: true });
});

test('merge with no prev and failed source gives zero items for it', () => {
  const { snapshot } = mergeSnapshot(null, [
    { sourceId: 'a', ok: true, items: many('a', 1) },
    { sourceId: 'b', ok: false, items: null, error: 'timeout' },
  ], NOW);
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.sources.b.count, 0);
});

test('merge aborts when total < 50% of previous', () => {
  const r = mergeSnapshot(prevOf(many('a', 100)), [{ sourceId: 'a', ok: true, items: many('a', 40) }], NOW);
  assert.equal(r.abort, true);
  assert.match(r.reason, /40/);
  assert.match(r.reason, /100/);
});

test('merge aborts when total is zero', () => {
  const r = mergeSnapshot(null, [{ sourceId: 'a', ok: false, items: null, error: 'x' }], NOW);
  assert.equal(r.abort, true);
});

test('merge does not abort on first run with items', () => {
  assert.equal(mergeSnapshot(null, [{ sourceId: 'a', ok: true, items: many('a', 5) }], NOW).abort, false);
});

test('merge drops duplicate ids keeping the later one', () => {
  const dup = [{ ...item('a', 1), title: 'old' }, { ...item('a', 1), title: 'new' }];
  const { snapshot } = mergeSnapshot(null, [{ sourceId: 'a', ok: true, items: dup }], NOW);
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].title, 'new');
});

test('merge drops sources not in this run unless keepOthers', () => {
  const prev = prevOf([...many('a', 2), ...many('gone', 2)]);
  const full = mergeSnapshot(prev, [{ sourceId: 'a', ok: true, items: many('a', 2) }], NOW);
  assert.equal(full.snapshot.items.some((i) => i.shopId === 'gone'), false);
  const only = mergeSnapshot(prev, [{ sourceId: 'a', ok: true, items: many('a', 2) }], NOW, { keepOthers: true });
  assert.equal(only.snapshot.items.filter((i) => i.shopId === 'gone').length, 2);
});

test('merge records the day an item first appears and keeps it on later runs', () => {
  const prev = prevOf([{ ...item('a', 0), firstSeen: '2026-11-10' }, item('a', 1)]);
  const { snapshot } = mergeSnapshot(prev, [{ sourceId: 'a', ok: true, items: [item('a', 0), item('a', 1), item('a', 2)] }], NOW);
  const by = Object.fromEntries(snapshot.items.map((i) => [i.id, i.firstSeen]));
  assert.equal(by['shopify:a:0'], '2026-11-10', 'kept');
  assert.equal(by['shopify:a:1'], undefined, 'items from before the date was recorded stay unmarked');
  assert.equal(by['shopify:a:2'], '2026-11-19', 'new today');
});

test('merge does not mark everything new on the first run or for a newly added shop', () => {
  const first = mergeSnapshot(null, [{ sourceId: 'a', ok: true, items: many('a', 3) }], NOW).snapshot;
  assert.ok(first.items.every((i) => i.firstSeen === undefined));
  const added = mergeSnapshot(prevOf(many('a', 2)), [{ sourceId: 'a', ok: true, items: many('a', 2) }, { sourceId: 'b', ok: true, items: many('b', 2) }], NOW).snapshot;
  assert.ok(added.items.every((i) => i.firstSeen === undefined));
});
