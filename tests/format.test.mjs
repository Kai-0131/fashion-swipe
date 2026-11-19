import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrateItems, formatPrice } from '../docs/js/format.js';

const shops = [{ id: 'rg', name: 'Roden Gray', domain: 'www.rodengray.com', platform: 'shopify', vintage: false }, { id: 'mv', name: 'Mintage', domain: 'mintagevintage.com', platform: 'shopify', vintage: true }];

test('hydrateItems adds url, shopName and vintage from shops', () => {
  const [a, b] = hydrateItems([{ id: 'shopify:rg:1', shopId: 'rg', handle: 'tee' }, { id: 'shopify:mv:2', shopId: 'mv', handle: 'sweat' }], shops);
  assert.equal(a.url, 'https://www.rodengray.com/products/tee');
  assert.equal(a.shopName, 'Roden Gray');
  assert.equal(a.vintage, false);
  assert.equal(b.vintage, true);
});

test('hydrateItems keeps an existing url and drops items of unknown shops', () => {
  const out = hydrateItems([{ id: 'y:1', shopId: 'yahoo', url: 'https://x/1', shopName: 'Yahoo' }, { id: 'shopify:zz:1', shopId: 'zz', handle: 'h' }], shops);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://x/1');
});

test('formatPrice by currency', () => {
  assert.equal(formatPrice(96800, 'JPY'), '¥96,800');
  assert.equal(formatPrice(69.5, 'CAD'), 'CA$69.50');
  assert.equal(formatPrice(45, 'USD'), 'US$45.00');
  assert.equal(formatPrice(null, 'USD'), '');
});

test('thumb asks the shopify image server for a smaller size, other hosts untouched', async () => {
  const { thumb } = await import('../docs/js/format.js');
  assert.equal(thumb('https://cdn.shopify.com/s/files/1/a.png', 800), 'https://cdn.shopify.com/s/files/1/a.png?width=800');
  assert.equal(thumb('https://images.pexels.com/p.jpeg?h=1200', 800), 'https://images.pexels.com/p.jpeg?h=1200');
  assert.equal(thumb(null, 800), null);
});

test('packImages stores each shop folder once and unpackImages restores the full addresses', async () => {
  const { packImages, unpackImages } = await import('../docs/js/format.js');
  const items = [
    { id: 'a', shopId: 'rg', images: ['https://cdn.shopify.com/s/files/1/0240/files/tee-1.jpg', 'https://cdn.shopify.com/s/files/1/0240/files/tee-2.jpg'] },
    { id: 'b', shopId: 'rg', images: ['https://cdn.shopify.com/s/files/1/0240/products/pant.jpg'] },
    { id: 'c', shopId: 'mv', images: ['https://mintage.com/cdn/shop/files/one.png'] },
  ];
  const packed = packImages(items);
  assert.deepEqual(packed.imageBase, { rg: 'https://cdn.shopify.com/s/files/1/0240/', mv: 'https://mintage.com/cdn/shop/files/' });
  assert.deepEqual(packed.items[0].images, ['files/tee-1.jpg', 'files/tee-2.jpg']);
  assert.deepEqual(packed.items[2].images, ['one.png']);
  assert.deepEqual(unpackImages(packed), items);
  assert.equal(items[0].images[0], 'https://cdn.shopify.com/s/files/1/0240/files/tee-1.jpg', 'input not changed');
});

test('unpackImages leaves an old list without imageBase as it is', async () => {
  const { unpackImages } = await import('../docs/js/format.js');
  const items = [{ id: 'a', shopId: 'rg', images: ['https://x/y.jpg'] }];
  assert.deepEqual(unpackImages({ items }), items);
});
