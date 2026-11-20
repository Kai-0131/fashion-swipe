import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDeck } from '../docs/js/deck.js';

const genres = JSON.parse(readFileSync('config/genres.json', 'utf8'));
const settings = { version: 1, likedGenres: ['cityboy'], maybeGenres: ['western'], suitColors: { near: [], far: [] }, slimPenalty: 0.3 };
// like: cityboy / near: minimal / maybe: western / challenge: y2k
const POOL = ['cityboy', 'minimal', 'western', 'y2k'];

function rngOf(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mkItems = (n, o = {}) => Array.from({ length: n }, (_, i) => ({
  id: `it${i}`, brand: `B${i % 50}`, images: ['x.jpg'], genres: [POOL[i % 4]], kind: 'top', slim: false, ...o,
}));
const mkLooks = (n) => Array.from({ length: n }, (_, i) => ({ id: `lk${i}`, image: 'l.jpg', genres: [POOL[i % 4]] }));

test('deck respects ratios over many runs', () => {
  const items = mkItems(1000);
  const looks = mkLooks(300);
  const count = { like: 0, near: 0, maybe: 0, challenge: 0, look: 0, total: 0 };
  const rng = rngOf(1);
  for (let r = 0; r < 300; r++) {
    for (const c of buildDeck({ items, looks, swipes: [], settings, genres, rng, size: 20 })) {
      count[c.bucket]++; count.total++; if (c.kind === 'look') count.look++;
    }
  }
  const f = (k) => count[k] / count.total;
  assert.ok(f('like') > 0.55 && f('like') < 0.65, `like ${f('like')}`);
  assert.ok(f('challenge') > 0.02 && f('challenge') < 0.08, `challenge ${f('challenge')}`);
  assert.ok(f('look') > 0.25 && f('look') < 0.35, `look ${f('look')}`);
});

test('deck has requested size', () => {
  assert.equal(buildDeck({ items: mkItems(100), looks: mkLooks(50), swipes: [], settings, genres, rng: rngOf(2) }).length, 20);
});

test('deck has no duplicate cards', () => {
  const deck = buildDeck({ items: mkItems(100), looks: mkLooks(50), swipes: [], settings, genres, rng: rngOf(3) });
  assert.equal(new Set(deck.map((c) => c.data.id)).size, deck.length);
});

test('deck excludes swiped and imageless', () => {
  const items = [...mkItems(3), { id: 'noimg', brand: 'X', images: [], genres: ['cityboy'], kind: 'top' }];
  const swipes = [{ itemId: 'it0', verdict: 'like', at: 'x', snapshot: { genres: ['cityboy'] } }];
  const deck = buildDeck({ items, looks: [], swipes, settings, genres, rng: rngOf(4) });
  const ids = deck.map((c) => c.data.id);
  assert.ok(!ids.includes('it0'));
  assert.ok(!ids.includes('noimg'));
  assert.equal(deck.length, 2);
});

test('deck fills from other buckets when one is empty', () => {
  const items = mkItems(40, { genres: ['y2k'] });
  const deck = buildDeck({ items, looks: [], swipes: [], settings, genres, rng: rngOf(5), size: 20 });
  assert.equal(deck.length, 20);
  assert.ok(deck.every((c) => c.bucket === 'challenge'));
});

test('deck returns [] when nothing left', () => {
  assert.deepEqual(buildDeck({ items: [], looks: [], swipes: [], settings, genres, rng: rngOf(6) }), []);
});

test('deck works with settings null', () => {
  const deck = buildDeck({ items: mkItems(100), looks: mkLooks(30), swipes: [], settings: null, genres, rng: rngOf(7) });
  assert.equal(deck.length, 20);
  assert.ok(deck.every((c) => c.bucket === 'maybe'));
});

test('deck avoids 3 same brand in a row', () => {
  // 8 of 20 share a brand: avoidable, but random order alone often makes a run of 3.
  const items = [...mkItems(8, { brand: 'Same' }), ...mkItems(12).map((x, i) => ({ ...x, id: `o${i}`, brand: `O${i}` }))];
  for (let s = 0; s < 50; s++) {
    const deck = buildDeck({ items, looks: [], swipes: [], settings, genres, rng: rngOf(10 + s), size: 20 });
    for (let i = 2; i < deck.length; i++) {
      const b = (k) => deck[k].data.brand;
      assert.ok(!(b(i) === b(i - 1) && b(i) === b(i - 2)), `seed ${s} at ${i}`);
    }
  }
});

test('slim items are drawn less when slimPenalty is set', () => {
  const items = [...mkItems(200, { genres: ['cityboy'], slim: true }), ...mkItems(200, { genres: ['cityboy'] }).map((x, i) => ({ ...x, id: `w${i}` }))];
  let slim = 0; let total = 0;
  const rng = rngOf(9);
  for (let r = 0; r < 100; r++) for (const c of buildDeck({ items, looks: [], swipes: [], settings, genres, rng, size: 20 })) { total++; if (c.data.slim) slim++; }
  assert.ok(slim / total < 0.35, `slim share ${slim / total}`);
});

test('genreFixes override item genres', () => {
  const items = mkItems(5, { genres: ['y2k'] });
  const deck = buildDeck({ items, looks: [], swipes: [], settings, genres, rng: rngOf(11), genreFixes: { it0: ['cityboy'] } });
  assert.equal(deck.find((c) => c.data.id === 'it0').bucket, 'like');
});

test('sold-out items are drawn about a third as often, never removed', () => {
  const items = mkItems(400).map((it, i) => ({ ...it, genres: ['cityboy'], soldOut: i % 2 === 0 }));
  const rng = rngOf(7);
  let gone = 0; let total = 0;
  for (let r = 0; r < 200; r++) for (const c of buildDeck({ items, swipes: [], settings, genres, rng, size: 20 })) { total++; if (c.data.soldOut) gone++; }
  const share = gone / total;
  assert.ok(share > 0.15 && share < 0.35, String(share)); // half the pool, weight 1/3 -> about 25%
});

test('items that appeared in the last 7 days are drawn about twice as often', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const items = mkItems(400).map((it, i) => ({ ...it, genres: ['cityboy'], ...(i % 2 === 0 ? { firstSeen: '2026-11-18' } : { firstSeen: '2026-11-01' }) }));
  const rng = rngOf(11);
  let fresh = 0; let total = 0;
  for (let r = 0; r < 200; r++) for (const c of buildDeck({ items, swipes: [], settings, genres, rng, size: 20, now })) { total++; if (c.data.firstSeen === '2026-11-18') fresh++; }
  const share = fresh / total;
  assert.ok(share > 0.58 && share < 0.75, String(share)); // half the pool, weight 2 -> about 67%
});
