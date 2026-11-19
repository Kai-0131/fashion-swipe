import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTables, classify, normBrand } from '../pipeline/classify.mjs';

const T = loadTables('config');
const base = { brand: '', title: '', productType: '', tags: [], options: [], shopGenres: [] };
const c = (o) => classify({ ...base, ...o }, T);

test('classify chino pants', () => {
  const r = c({ brand: 'Battenwear', title: 'Weekend Pants - Smoke Grey Chino', productType: 'Outerwear' });
  assert.equal(r.kind, 'bottom');
  assert.deepEqual(r.colors, ['gray']);
  assert.ok(r.genres.includes('amekaji-work'));
});

test('classify shirt jacket is outer', () => {
  assert.equal(c({ title: 'Wool Shirt Jacket Navy' }).kind, 'outer');
});

test('classify bootcut jean is bottom not shoes', () => {
  assert.equal(c({ title: 'Boot Cut Jean' }).kind, 'bottom');
});

test('classify tee and shoes and accessory', () => {
  assert.equal(c({ title: 'Basic Stussy Tee' }).kind, 'top');
  assert.equal(c({ title: 'Samba OG', productType: 'Footwear' }).kind, 'shoes');
  assert.equal(c({ title: 'Indigo Denim Coin Pouch' }).kind, 'accessory');
});

test('classify japanese kind words', () => {
  assert.equal(c({ title: 'ワイド チノ パンツ' }).kind, 'bottom');
  assert.equal(c({ title: 'PERTEX® QUANTUM Recycle Down Jacket', productType: 'OUTER' }).kind, 'outer');
});

test('classify uses shopGenres when brand unknown', () => {
  const r = c({ brand: 'Nobody Brand', title: 'Plain Tee', shopGenres: ['cityboy'] });
  assert.deepEqual(r.genres, ['cityboy']);
});

test('classify keyword genres', () => {
  assert.ok(c({ title: 'Double Knee Carpenter Pant' }).genres.includes('amekaji-work'));
  assert.ok(c({ title: 'Cable Knit Cardigan' }).genres.includes('knit-leather'));
});

test('classify caps genres at 3 without duplicates', () => {
  const r = c({ brand: 'Stan Ray', title: 'Chore Coat Cable Football Rugby', shopGenres: ['cityboy', 'mode'] });
  assert.ok(r.genres.length <= 3);
  assert.equal(new Set(r.genres).size, r.genres.length);
});

test('classify detects slim', () => {
  assert.equal(c({ title: 'Slim Fit Jean' }).slim, true);
  assert.equal(c({ title: 'Wide Jean' }).slim, false);
});

test('classify color from single color option', () => {
  assert.deepEqual(c({ title: 'Work Jacket', options: [{ name: 'Color', values: ['Navy'] }] }).colors, ['navy']);
});

test('classify ignores ambiguous multi color options', () => {
  assert.deepEqual(c({ title: 'Work Jacket', options: [{ name: 'Color', values: ['Navy', 'Olive', 'Black'] }] }).colors, []);
});

test('classify unknown color gives empty colors', () => {
  assert.deepEqual(c({ title: 'Work Jacket Sunrise' }).colors, []);
});

test('classify multiword colors', () => {
  assert.deepEqual(c({ title: 'Sweatshirt Washed Black' }).colors, ['fadedblack']);
  assert.deepEqual(c({ title: 'Tee Off White' }).colors, ['ecru']);
});

test('normBrand strips accents and punctuation', () => {
  assert.equal(normBrand('Aimé Leon Dore'), 'aime leon dore');
  assert.equal(normBrand("Drake's"), 'drakes');
  assert.equal(normBrand('A.P.C.'), 'apc');
});

test('classify hood is top and acorn walnut mint colors', () => {
  assert.equal(c({ title: 'Patch Zip Hood (Grey Heather)' }).kind, 'top');
  assert.deepEqual(c({ title: 'Patch Hood (Washed Acorn)' }).colors, ['brown']);
  assert.deepEqual(c({ title: 'Woven in Walnut' }).colors, ['brown']);
  assert.deepEqual(c({ title: 'Card Case in Mint' }).colors, ['green']);
});
