import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchShopifyShop } from '../pipeline/sources/shopify.mjs';

const shop = { id: 's', name: 'S', domain: 'shop.example', platform: 'shopify', country: 'US', currency: 'USD', genres: [] };

function fakeDeps(pages) {
  const urls = [];
  const sleeps = [];
  return {
    urls, sleeps,
    deps: {
      fetchJson: async (url) => {
        urls.push(url);
        const n = Number(new URL(url).searchParams.get('page'));
        const p = typeof pages === 'function' ? pages(n) : pages[n - 1];
        return p ?? { ok: true, status: 200, json: { products: [] }, error: null };
      },
      sleep: async (ms) => { sleeps.push(ms); },
    },
  };
}
const page = (k) => ({ ok: true, status: 200, json: { products: Array.from({ length: k }, (_, i) => ({ id: i })) }, error: null });

test('fetchShopifyShop paginates until empty page', async () => {
  const f = fakeDeps([page(2), page(0)]);
  const r = await fetchShopifyShop(shop, f.deps);
  assert.equal(r.ok, true);
  assert.equal(r.products.length, 2);
  assert.deepEqual(f.urls, [
    'https://shop.example/products.json?limit=250&page=1',
    'https://shop.example/products.json?limit=250&page=2',
  ]);
});

test('fetchShopifyShop stops at maxPages', async () => {
  const f = fakeDeps(() => page(1));
  const r = await fetchShopifyShop({ ...shop, maxPages: 2 }, f.deps);
  assert.equal(r.products.length, 2);
  assert.equal(f.urls.length, 2);
});

test('fetchShopifyShop defaults maxPages to 4', async () => {
  const f = fakeDeps(() => page(1));
  await fetchShopifyShop(shop, f.deps);
  assert.equal(f.urls.length, 4);
});

test('fetchShopifyShop fails whole shop on mid-way 429', async () => {
  const f = fakeDeps([page(2), { ok: false, status: 429, json: null, error: 'rate_limited' }]);
  const r = await fetchShopifyShop(shop, f.deps);
  assert.deepEqual(r, { ok: false, products: null, error: 'rate_limited' });
});

test('fetchShopifyShop fails when json has no products array', async () => {
  const f = fakeDeps([{ ok: true, status: 200, json: { errors: 'x' }, error: null }]);
  const r = await fetchShopifyShop(shop, f.deps);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'bad_shape');
});

test('fetchShopifyShop sleeps >= 3000ms between pages', async () => {
  const f = fakeDeps([page(1), page(1), page(0)]);
  await fetchShopifyShop(shop, f.deps);
  assert.ok(f.sleeps.length >= 2);
  assert.ok(f.sleeps.every((ms) => ms >= 3000));
});

test('fetchShopifyShop treats an empty first page as a failure', async () => {
  const f = fakeDeps([page(0)]);
  assert.deepEqual(await fetchShopifyShop(shop, f.deps), { ok: false, products: null, error: 'empty' });
});
