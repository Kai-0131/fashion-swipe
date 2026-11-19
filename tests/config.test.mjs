import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTables } from '../pipeline/classify.mjs';

const T = loadTables('config');
const ids = new Set(T.genres.genres.map((g) => g.id));
const colorIds = new Set(Object.keys(T.colors.pairs));

test('genre neighbors exist and are bidirectional', () => {
  for (const g of T.genres.genres) {
    for (const n of g.neighbors) {
      assert.ok(ids.has(n), `${g.id} -> ${n}`);
      assert.ok(T.genres.genres.find((x) => x.id === n).neighbors.includes(g.id), `${n} lacks ${g.id}`);
    }
  }
});

test('core genres exist', () => {
  for (const id of ['amekaji-work', '90s-denim', 'prep-casual', 'cityboy', 'vintage-sports', 'knit-leather']) assert.ok(ids.has(id), id);
});

test('shops are well formed', () => {
  for (const s of T.shops.shops) {
    assert.ok(s.id && s.name, JSON.stringify(s));
    assert.ok(['shopify', 'link'].includes(s.platform), s.id);
    assert.ok(['CA', 'US', 'GB', 'JP', 'EU'].includes(s.country), s.id);
    if (s.platform === 'shopify') assert.ok(s.domain && s.currency, s.id);
    if (s.platform === 'link') assert.match(s.linkUrl, /^https:\/\//, s.id);
    for (const g of s.genres) assert.ok(ids.has(g), `${s.id}: ${g}`);
  }
  assert.equal(new Set(T.shops.shops.map((s) => s.id)).size, T.shops.shops.length);
});

test('brand and keyword genres exist', () => {
  for (const [b, gs] of Object.entries(T.brands)) for (const g of gs) assert.ok(ids.has(g), `${b}: ${g}`);
  for (const [w, gs] of Object.entries(T.keywords.genres)) for (const g of gs) assert.ok(ids.has(g), `${w}: ${g}`);
});

test('color pairs and words use known color ids', () => {
  for (const [k, vs] of Object.entries(T.colors.pairs)) for (const v of vs) assert.ok(colorIds.has(v), `${k} -> ${v}`);
  for (const [w, id] of Object.entries(T.colors.words)) assert.ok(colorIds.has(id), `${w} -> ${id}`);
});

test('people have names, known genres and a search phrase', () => {
  for (const p of T.people.people) {
    assert.ok(p.name && p.search, JSON.stringify(p));
    for (const g of p.genres) assert.ok(ids.has(g), `${p.name}: ${g}`);
    if (p.instagram) assert.match(p.instagramSource, /^https:\/\//, p.name);
  }
});
