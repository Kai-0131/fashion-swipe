import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePack, makeBackup, parseBackup } from '../docs/js/pack.js';

const settings = { version: 1, likedGenres: ['cityboy'], maybeGenres: [], suitColors: { near: ['navy'], far: ['olive'] }, slimPenalty: 0.3 };
const pack = (o = {}) => JSON.stringify({ kind: 'fashion-swipe-pack', version: 1, settings, photos: [{ id: 'p1', genres: ['cityboy'], dataUrl: 'data:image/jpeg;base64,AAA' }], ...o });

test('parsePack accepts a valid pack', () => {
  const r = parsePack(pack());
  assert.deepEqual(r.settings, settings);
  assert.equal(r.photos[0].id, 'p1');
});

test('parsePack rejects wrong version with a japanese message', () => {
  assert.throws(() => parsePack(pack({ version: 2 })), /設定ファイルの版/);
});

test('parsePack rejects missing suitColors', () => {
  const bad = JSON.stringify({ kind: 'fashion-swipe-pack', version: 1, settings: { ...settings, suitColors: undefined }, photos: [] });
  assert.throws(() => parsePack(bad), /似合う色/);
});

test('parsePack rejects non-json and other files', () => {
  assert.throws(() => parsePack('not json'), /読めません/);
  assert.throws(() => parsePack(JSON.stringify({ kind: 'fashion-swipe-backup', version: 1 })), /設定ファイルではありません/);
});

test('parsePack rejects photos without data', () => {
  assert.throws(() => parsePack(pack({ photos: [{ id: 'x', genres: [] }] })), /写真/);
});

test('backup round trips', async () => {
  const state = {
    settings,
    swipes: { a: { itemId: 'a', kind: 'item', verdict: 'fav', at: 't', priceAtSave: 10, currency: 'USD', snapshot: {} } },
    closet: [{ id: 'c1', kind: 'top', colors: ['navy'], photo: 'data:image/jpeg;base64,BBB' }],
    myPhotos: [{ id: 'p1', genres: ['cityboy'], photo: 'data:image/jpeg;base64,CCC' }],
    genreFixes: { a: ['mode'] },
  };
  const json = await makeBackup(state, '2026-11-19T00:00:00Z');
  assert.deepEqual(parseBackup(json), state);
  assert.equal(JSON.parse(json).kind, 'fashion-swipe-backup');
});

test('backup converts Blob photos to data urls', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const json = await makeBackup({ settings: null, swipes: {}, closet: [{ id: 'c', kind: 'top', colors: [], photo: blob }], myPhotos: [], genreFixes: {} }, 't');
  assert.equal(parseBackup(json).closet[0].photo, 'data:image/jpeg;base64,AQID');
});

test('parseBackup rejects random json', () => {
  assert.throws(() => parseBackup('{"a":1}'), /バックアップ/);
});
