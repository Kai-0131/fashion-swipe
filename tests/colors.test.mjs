import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { faceBadge, matchColors, COLOR_LABELS } from '../docs/js/colors.js';

const { pairs } = JSON.parse(readFileSync('config/colors.json', 'utf8'));
const settings = {
  version: 1, likedGenres: [], maybeGenres: [], slimPenalty: 0.3,
  suitColors: { near: ['white', 'gray', 'charcoal', 'navy', 'fadedblack', 'denim', 'red', 'burgundy'], far: ['ecru', 'brown', 'olive', 'beige', 'mustard'] },
};

test('badge null without settings', () => {
  assert.equal(faceBadge({ colors: ['navy'], kind: 'top' }, null), null);
});

test('badge null for bottoms and shoes', () => {
  assert.equal(faceBadge({ colors: ['olive'], kind: 'bottom' }, settings), null);
  assert.equal(faceBadge({ colors: ['olive'], kind: 'shoes' }, settings), null);
});

test('badge near for navy top', () => {
  assert.equal(faceBadge({ colors: ['navy'], kind: 'top' }, settings), 'near');
});

test('badge far for olive jacket', () => {
  assert.equal(faceBadge({ colors: ['olive'], kind: 'outer' }, settings), 'far');
  assert.equal(faceBadge({ colors: ['navy', 'olive'], kind: 'outer' }, settings), 'far');
});

test('badge null for unknown or unlisted color', () => {
  assert.equal(faceBadge({ colors: [], kind: 'top' }, settings), null);
  assert.equal(faceBadge({ colors: ['green'], kind: 'top' }, settings), null);
});

test('matchColors excludes far colors, puts near first, caps at 4', () => {
  const r = matchColors(['olive'], pairs, settings);
  assert.ok(r.length <= 4 && r.length > 0);
  for (const c of r) assert.ok(!settings.suitColors.far.includes(c), c);
  assert.ok(settings.suitColors.near.includes(r[0]));
});

test('matchColors without settings returns general pairs', () => {
  assert.deepEqual(matchColors(['olive'], pairs, null), pairs.olive.slice(0, 4));
});

test('matchColors handles unknown and multiple colors without duplicates', () => {
  assert.deepEqual(matchColors([], pairs, settings), []);
  const r = matchColors(['navy', 'gray'], pairs, null);
  assert.equal(new Set(r).size, r.length);
});

test('every color id has a japanese label and hex', () => {
  for (const id of Object.keys(pairs)) {
    assert.ok(COLOR_LABELS[id]?.ja, id);
    assert.match(COLOR_LABELS[id].hex, /^#[0-9a-f]{6}$/i, id);
  }
});
