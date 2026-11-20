import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasteProfile, tasteFactor } from '../docs/js/learn.js';
import { suitFactor, faceLabel } from '../docs/js/colors.js';
import { backupDue } from '../docs/js/pack.js';
import { buildDeck } from '../docs/js/deck.js';

const sw = (verdict, snap, kind = 'item') => ({ itemId: Math.random().toString(36), kind, verdict, at: '2026-11-19', snapshot: { genres: ['skate'], ...snap } });
const settings = { version: 1, likedGenres: ['skate'], maybeGenres: [], suitColors: { near: ['white', 'gray', 'navy'], far: ['olive', 'beige'] }, slimPenalty: 1 };

test('tasteProfile scores brands, colors and kinds from item swipes only', () => {
  const p = tasteProfile([
    sw('fav', { brand: 'Stüssy', colors: ['navy'], kind: 'top' }),
    sw('like', { brand: 'Stüssy', colors: ['white'], kind: 'top' }),
    sw('meh', { brand: 'Kith', colors: ['olive'], kind: 'outer' }),
    sw('fav', { brand: 'Noah', colors: ['red'], kind: 'top' }, 'look'),
  ]);
  assert.equal(p.brand['Stüssy'], 3);
  assert.equal(p.brand.Kith, -0.5);
  assert.equal(p.brand.Noah, undefined, 'outfit photos are not shop items');
  assert.equal(p.color.navy, 2);
  assert.equal(p.kind.top, 3);
});

test('tasteFactor raises liked brands and colors, lowers disliked ones, and stays within 0.5 to 2', () => {
  const p = { brand: { 'Stüssy': 10, Kith: -10 }, color: { navy: 10, olive: -10 }, kind: { top: 10 } };
  const up = tasteFactor({ brand: 'Stüssy', colors: ['navy'], kind: 'top' }, p);
  const down = tasteFactor({ brand: 'Kith', colors: ['olive'], kind: 'outer' }, p);
  assert.ok(up > 1.5 && up <= 2, String(up));
  assert.ok(down < 1 && down >= 0.5, String(down));
  assert.equal(tasteFactor({ brand: 'X', colors: [], kind: 'shoes' }, p), 1);
  assert.equal(tasteFactor({ brand: 'X' }, tasteProfile([])), 1);
});

test('suitFactor prefers tops in colors that suit the face, never removes the others', () => {
  assert.equal(suitFactor({ kind: 'top', colors: ['white'] }, settings), 1.3);
  assert.equal(suitFactor({ kind: 'outer', colors: ['olive'] }, settings), 0.75);
  assert.equal(suitFactor({ kind: 'bottom', colors: ['olive'] }, settings), 1);
  assert.equal(suitFactor({ kind: 'top', colors: ['white'] }, null), 1);
});

test('faceLabel tells how to wear a top in an unsuited color', () => {
  assert.equal(faceLabel('near', settings), '● 顔の近くOK');
  assert.equal(faceLabel('far', settings), '● 顔まわりは苦手な色 → 首元に白・グレーを挟めばOK');
  assert.equal(faceLabel(null, settings), null);
});

test('backupDue after 7 days with new swipes, or when there was never a backup and 10+ swipes', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const swipes = [{ at: '2026-11-29T00:00:00Z' }];
  assert.equal(backupDue({ lastBackupAt: '2026-11-20T00:00:00Z', swipes, now }), true);
  assert.equal(backupDue({ lastBackupAt: '2026-11-28T00:00:00Z', swipes, now }), false, 'recent backup');
  assert.equal(backupDue({ lastBackupAt: '2026-11-20T00:00:00Z', swipes: [{ at: '2026-11-19T00:00:00Z' }], now }), false, 'nothing new since');
  assert.equal(backupDue({ lastBackupAt: null, swipes: Array.from({ length: 10 }, () => ({ at: '2026-11-29' })), now }), true);
  assert.equal(backupDue({ lastBackupAt: null, swipes: [{ at: '2026-11-29' }], now }), false);
});

test('buildDeck picks suited colors and liked brands more often inside the same genre', () => {
  const genres = { genres: [{ id: 'skate', neighbors: [] }] };
  const items = [
    { id: 'a', brand: 'Stüssy', kind: 'top', colors: ['white'], genres: ['skate'], images: ['x'] },
    { id: 'b', brand: 'Kith', kind: 'top', colors: ['olive'], genres: ['skate'], images: ['x'] },
  ];
  const swipes = [sw('fav', { brand: 'Stüssy', colors: ['white'], kind: 'top' }), sw('fav', { brand: 'Stüssy', colors: ['white'], kind: 'top' })];
  let seed = 1;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let a = 0;
  for (let i = 0; i < 400; i++) if (buildDeck({ items, swipes, settings, genres, rng, size: 1 })[0].data.id === 'a') a++;
  assert.ok(a > 260, `a picked ${a}/400`);
  assert.ok(a < 400, 'b still appears');
});

test('a reason teaches only that part: color reason moves color, shape reason leaves color, brand and kind alone', () => {
  const p = tasteProfile([
    { ...sw('meh', { brand: 'Kith', colors: ['navy'], kind: 'top' }), reasons: { color: 1, shape: -1 } },
    { ...sw('like', { brand: 'Noah', colors: ['olive'], kind: 'outer' }), reasons: { shape: 1 } },
    { ...sw('fav', { brand: 'Polar', colors: ['red'], kind: 'top' }), reasons: { color: -1 } },
  ]);
  assert.equal(p.color.navy, 1, 'liked color counts as liked even on a 普通 swipe');
  assert.equal(p.color.olive, undefined, 'shape-only reason does not move the color');
  assert.equal(p.color.red, -1, 'disliked color counts as disliked even on a favourite');
  assert.deepEqual(p.brand, {});
  assert.deepEqual(p.kind, {});
});
