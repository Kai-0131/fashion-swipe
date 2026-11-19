import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceDrops } from '../docs/js/drops.js';

const sw = (itemId, verdict, priceAtSave, currency = 'USD') => ({ itemId, kind: 'item', verdict, at: '2026-11-19', priceAtSave, currency, snapshot: {} });
const map = (...items) => new Map(items.map((i) => [i.id, i]));

test('drops detects lower price', () => {
  const r = priceDrops([sw('a', 'fav', 100)], map({ id: 'a', price: 80, compareAt: null, currency: 'USD' }));
  assert.deepEqual(r, [{ itemId: 'a', was: 100, now: 80, compareAt: null, currency: 'USD', gone: false }]);
});

test('drops detects sale via compareAt', () => {
  const r = priceDrops([sw('a', 'like', 100)], map({ id: 'a', price: 100, compareAt: 140, currency: 'USD' }));
  assert.equal(r.length, 1);
  assert.equal(r[0].compareAt, 140);
});

test('drops marks gone items', () => {
  const r = priceDrops([sw('a', 'fav', 100)], map());
  assert.deepEqual(r, [{ itemId: 'a', was: 100, now: null, compareAt: null, currency: 'USD', gone: true }]);
});

test('drops ignores currency change', () => {
  assert.deepEqual(priceDrops([sw('a', 'fav', 100, 'CAD')], map({ id: 'a', price: 80, compareAt: null, currency: 'USD' })), []);
});

test('drops ignores meh, looks, and unchanged prices', () => {
  const items = map({ id: 'a', price: 80, compareAt: null, currency: 'USD' }, { id: 'b', price: 100, compareAt: null, currency: 'USD' });
  const swipes = [sw('a', 'meh', 100), { ...sw('l', 'fav', null), kind: 'look' }, sw('b', 'fav', 100)];
  assert.deepEqual(priceDrops(swipes, items), []);
});
