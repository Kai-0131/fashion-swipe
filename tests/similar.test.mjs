import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarItems, searchLinks, mapsLink } from '../docs/js/similar.js';
import { closetMatches } from '../docs/js/closet-match.js';
import { readFileSync } from 'node:fs';

const { pairs } = JSON.parse(readFileSync('config/colors.json', 'utf8'));
const it = (id, o) => ({ id, brand: 'B', kind: 'outer', genres: ['amekaji-work'], colors: ['navy'], images: ['x'], ...o });

test('similar: same kind, overlapping genre, excludes self, color matches first', () => {
  const me = it('me');
  const items = [me, it('a', { colors: ['olive'] }), it('b'), it('c', { kind: 'top' }), it('d', { genres: ['mode'] })];
  const r = similarItems(me, items).map((x) => x.id);
  assert.deepEqual(r, ['b', 'a']);
});

test('similar caps at n', () => {
  const items = Array.from({ length: 20 }, (_, i) => it(`x${i}`));
  assert.equal(similarItems(it('me'), items, 6).length, 6);
});

test('searchLinks has 5 links with encoded keyword', () => {
  const links = searchLinks({ brand: 'Stan Ray', kind: 'outer', title: 'Shop Jacket' });
  assert.equal(links.length, 5);
  assert.deepEqual(links.map((l) => l.label), ['メルカリ', 'Grailed', 'eBay', 'SSENSE', 'ZOZOTOWN']);
  assert.equal(links[0].url, 'https://jp.mercari.com/search?keyword=Stan%20Ray%20jacket');
  assert.equal(links[4].url, 'https://store.shopping.yahoo.co.jp/zozo/search.html?p=Stan%20Ray%20jacket');
});

test('searchLinks encodes japanese brands', () => {
  const url = searchLinks({ brand: 'グラフペーパー', kind: 'bottom' })[0].url;
  assert.ok(url.endsWith(encodeURIComponent('グラフペーパー pants')));
});

test('mapsLink', () => {
  assert.equal(mapsLink('Roden Gray Vancouver'), 'https://www.google.com/maps/search/?api=1&query=Roden%20Gray%20Vancouver');
});

test('closetMatches picks other kinds with paired colors, max 3', () => {
  const item = { kind: 'outer', colors: ['olive'] };
  const closet = [
    { id: 1, kind: 'outer', colors: ['white'] },
    { id: 2, kind: 'top', colors: ['white'] },
    { id: 3, kind: 'bottom', colors: ['denim'] },
    { id: 4, kind: 'top', colors: ['red'] },
    { id: 5, kind: 'shoes', colors: ['black'] },
    { id: 6, kind: 'bottom', colors: ['ecru'] },
  ];
  const r = closetMatches(item, closet, pairs).map((c) => c.id);
  assert.deepEqual(r, [2, 3, 5]);
});

test('closetMatches empty when item color unknown', () => {
  assert.deepEqual(closetMatches({ kind: 'top', colors: [] }, [{ id: 1, kind: 'bottom', colors: ['denim'] }], pairs), []);
});
