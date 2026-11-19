import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPack, assertInsidePrivate } from '../tools/build-my-pack.mjs';
import { parsePack } from '../docs/js/pack.js';

const settings = { version: 1, likedGenres: ['cityboy'], maybeGenres: [], suitColors: { near: ['navy'], far: ['olive'] }, slimPenalty: 0.3 };
const files = { 'private/photos/a.jpg': Buffer.from([1, 2, 3]) };
const readFile = (p) => { const k = p.split('\\').join('/').replace(/^.*?private\//, 'private/'); if (!files[k]) throw new Error(`missing ${p}`); return files[k]; };

test('buildPack output passes parsePack', () => {
  const text = buildPack({ settings, photos: [{ id: 'a', genres: ['cityboy'], file: 'photos/a.jpg' }], readFile, root: 'private' });
  const r = parsePack(text);
  assert.deepEqual(r.settings, settings);
  assert.equal(r.photos[0].dataUrl, 'data:image/jpeg;base64,AQID');
});

test('buildPack fails loudly on a missing photo', () => {
  assert.throws(() => buildPack({ settings, photos: [{ id: 'b', genres: [], file: 'photos/missing.jpg' }], readFile, root: 'private' }), /missing/);
});

test('assertInsidePrivate refuses paths outside private/', () => {
  assert.throws(() => assertInsidePrivate('docs/data/my-pack.json'), /private/);
  assert.doesNotThrow(() => assertInsidePrivate('private/my-pack.json'));
});
