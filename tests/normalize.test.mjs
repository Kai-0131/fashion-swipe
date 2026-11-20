import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTables } from '../pipeline/classify.mjs';
import { normalizeShopify } from '../pipeline/normalize.mjs';

const T = loadTables('config');
const shop = { id: 'rodengray', name: 'Roden Gray', domain: 'www.rodengray.com', platform: 'shopify', country: 'CA', currency: 'CAD', genres: ['minimal'] };
const NOW = '2026-11-19T11:20:00Z';
const prod = (o = {}) => ({
  id: 77, title: 'Computer Ringer Tee in Navy', handle: 'computer-ringer-tee', vendor: 'Basketcase', product_type: 'Clothing - Mens - T-Shirts',
  tags: [], options: [], images: [{ src: 'https://cdn.shopify.com/a.jpg' }, { src: 'https://cdn.shopify.com/b.jpg' }],
  variants: [{ price: '69.50', compare_at_price: '115.00', available: true }], ...o,
});

test('normalize maps a product', () => {
  const it = normalizeShopify(prod(), shop, T, NOW);
  assert.equal(it.id, 'shopify:rodengray:77');
  assert.equal(it.source, 'shopify');
  assert.equal(it.shopId, 'rodengray');
  assert.equal(it.brand, 'Basketcase');
  assert.equal(it.handle, 'computer-ringer-tee');
  assert.equal('url' in it, false);
  assert.equal('shopName' in it, false);
  assert.equal('fetchedAt' in it, false);
  assert.deepEqual(it.images, ['https://cdn.shopify.com/a.jpg', 'https://cdn.shopify.com/b.jpg']);
  assert.equal(it.price, 69.5);
  assert.equal(it.compareAt, 115);
  assert.equal(it.currency, 'CAD');
  assert.equal(it.kind, 'top');
  assert.deepEqual(it.colors, ['navy']);
});

test('normalize compareAt null when missing, zero, or not higher', () => {
  for (const v of [null, '0.00', '69.50', '50.00']) {
    const it = normalizeShopify(prod({ variants: [{ price: '69.50', compare_at_price: v }] }), shop, T, NOW);
    assert.equal(it.compareAt, null, String(v));
  }
});

test('normalize drops gift card and non clothing', () => {
  assert.equal(normalizeShopify(prod({ title: 'Stan Ray Gift Card', product_type: 'GIFT CARDS' }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ title: 'Café Leon Dore Espresso Beans', product_type: 'Grocery - Private Label' }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ title: 'Darth Maul Action Figure', product_type: 'Drawing' }), shop, T, NOW), null);
});

test('normalize drops product without images', () => {
  assert.equal(normalizeShopify(prod({ images: [] }), shop, T, NOW), null);
});

test('normalize drops womens product', () => {
  assert.equal(normalizeShopify(prod({ tags: ['Womens'] }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ title: 'Springblade Runner W' }), shop, T, NOW), null);
});

test('normalize drops product without a valid price', () => {
  assert.equal(normalizeShopify(prod({ variants: [] }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ variants: [{ price: 'abc' }] }), shop, T, NOW), null);
});

test('normalize prefers an available variant', () => {
  const it = normalizeShopify(prod({ variants: [{ price: '10.00', available: false }, { price: '20.00', available: true }] }), shop, T, NOW);
  assert.equal(it.price, 20);
});

test('normalize keeps at most 3 images without query strings', () => {
  const imgs = Array.from({ length: 6 }, (_, i) => ({ src: `https://cdn.shopify.com/${i}.jpg?v=123` }));
  const it = normalizeShopify(prod({ images: imgs }), shop, T, NOW);
  assert.deepEqual(it.images, ['https://cdn.shopify.com/0.jpg', 'https://cdn.shopify.com/1.jpg', 'https://cdn.shopify.com/2.jpg']);
});

test('normalize drops goods that are not worn or carried, but keeps accessories', () => {
  for (const title of ['Unisphere Zippo Lighter', 'Saint George Ashtray', 'Queens Crest Throw Pillow', 'Sun-Bleached Cushion In Navy', 'Textile Patterned Bud Vase', 'NALGENE WATER BOTTLE', 'Mulberry Playing Cards', 'Kaweco Script Mechanical Pencil', 'Unisphere Slip Mats', 'CASHMERE BLANKET', 'Large Unisphere Herb Grinder', 'Atlas Vintage Leather 10 Lb Kettle Bell', 'シャンプー　森へ行く日　500ml', 'METAL PILL LIGHTER CASE']) {
    assert.equal(normalizeShopify(prod({ title, product_type: '' }), shop, T, NOW), null, title);
  }
  for (const title of ['Gallo Sunglasses', '14Kt Gold Dove Pendant', 'Leather Card Holder', 'Leather Key Fob', 'ALD Pin', 'Tumbled Leather Duffle', 'Leather Passport Holder', 'FLOATIE KEYCHAIN', '2010-12 Italy adidas World Cup Scarf', 'Graphpaper Voile Gabardine Drawstring Bag', '3WAY LARGE TOTE OIL SUEDE COFFEE BROWN']) {
    const it = normalizeShopify(prod({ title, product_type: '' }), shop, T, NOW);
    assert.ok(it, title);
    assert.equal(it.kind, 'accessory', title);
  }
});

test('normalize drops dresses but keeps dress shirts and dress trousers', () => {
  assert.equal(normalizeShopify(prod({ title: 'Lula Mini Dress in White', product_type: '' }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ title: 'Viscose Cupro Back Satin Sleeveless Dress', product_type: '' }), shop, T, NOW), null);
  assert.equal(normalizeShopify(prod({ title: 'Oxford Dress Shirt', product_type: '' }), shop, T, NOW).kind, 'top');
  assert.equal(normalizeShopify(prod({ title: 'Wool Dress Trousers', product_type: '' }), shop, T, NOW).kind, 'bottom');
});

test('normalize gives clothes that were filed as other their real kind', () => {
  const kind = (title) => normalizeShopify(prod({ title, product_type: '' }), shop, T, NOW).kind;
  assert.equal(kind('Beach Breaker (Lined) - Orange Nylon'), 'outer');
  assert.equal(kind('Wool Herringbone Overcoat'), 'outer');
  assert.equal(kind('Deliberate Casual Reach-Up Hoody / Black'), 'top');
  assert.equal(kind('BASIC STÜSSY CREW'), 'top');
  assert.equal(kind('1995-96 AC Milan Lotto 1/4 Zip Tracksuit'), 'outer');
});

test('normalize uses the shop brand when the shop lists a wrong maker name', () => {
  const stussy = { id: 'stussy', name: 'Stüssy', domain: 'www.stussy.com', platform: 'shopify', country: 'US', currency: 'USD', genres: ['skate'], vendorAliases: { Radial: 'Stüssy' } };
  assert.equal(normalizeShopify(prod({ vendor: 'Radial' }), stussy, T, NOW).brand, 'Stüssy');
  assert.equal(normalizeShopify(prod({ vendor: 'Nike' }), stussy, T, NOW).brand, 'Nike');
});

test('shops.json fixes the Stussy maker name', () => {
  assert.deepEqual(T.shops.shops.find((s) => s.id === 'stussy').vendorAliases, { Radial: 'Stüssy' });
});

test('normalize follows a saved judgment for genre and kind, and drops what was judged not fashion', () => {
  const tables = { ...T, judgments: { 'shopify:rodengray:77': { g: ['skate', 'y2k'], k: 'outer' }, 'shopify:rodengray:78': { x: 1 } } };
  const it = normalizeShopify(prod(), shop, tables, NOW);
  assert.deepEqual(it.genres, ['skate', 'y2k']);
  assert.equal(it.kind, 'outer');
  assert.deepEqual(it.colors, ['navy'], 'colors still from the title');
  assert.equal(normalizeShopify(prod({ id: 78 }), shop, tables, NOW), null);
  assert.equal(normalizeShopify(prod({ id: 79 }), shop, tables, NOW).kind, 'top', 'no judgment: rules');
});

test('loadTables reads judgments, empty when the file is missing', async () => {
  const { mkdtempSync, cpSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'fs-'));
  cpSync('config', dir, { recursive: true });
  rmSync(join(dir, 'item-judgments.json'), { force: true });
  assert.deepEqual(loadTables(dir).judgments, {});
  rmSync(dir, { recursive: true });
});

test('normalize strips a shop label in front of the maker name', () => {
  const fg = { id: 'frontgeneral', name: 'Front General Store', domain: 'x', platform: 'shopify', country: 'US', currency: 'USD', genres: ['amekaji-work'], vendorPrefixes: ['Designer / ', 'Vintage / '] };
  assert.equal(normalizeShopify(prod({ vendor: 'Designer / Issey Miyake' }), fg, T, NOW).brand, 'Issey Miyake');
  assert.equal(normalizeShopify(prod({ vendor: 'Vintage / Ralph Lauren' }), fg, T, NOW).brand, 'Ralph Lauren');
});

test('shops.json fixes odd maker names of Drakes, Noah, Polar and Front General Store', () => {
  const s = (id) => T.shops.shops.find((x) => x.id === id);
  assert.equal(s('drakes').vendorAliases['Drakes - UK/ROW'], "Drake's");
  assert.equal(s('noah').vendorAliases['0'], 'Noah');
  assert.equal(s('polar').vendorAliases['Polar Skate Co'], 'Polar Skate Co.');
  assert.equal(s('frontgeneral').vendorAliases.Jewelry_SV, 'Front General Store');
  assert.ok(s('frontgeneral').vendorPrefixes.includes('Designer / '));
});

test('normalize marks an item sold out only when every size is gone', () => {
  const gone = normalizeShopify(prod({ variants: [{ price: '10.00', available: false }, { price: '10.00', available: false }] }), shop, T, NOW);
  assert.equal(gone.soldOut, true);
  const some = normalizeShopify(prod({ variants: [{ price: '10.00', available: false }, { price: '10.00', available: true }] }), shop, T, NOW);
  assert.equal('soldOut' in some, false, 'not written when something is left (keeps the list small)');
});
