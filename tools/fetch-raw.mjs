// Fetches every Shopify shop once and keeps only the fields normalize uses, in private/raw-products.json
// (owner's PC only; input for tools/judging.mjs export). Same spacing as the daily fetch.
import { writeFileSync } from 'node:fs';
import { fetchJson, sleep } from '../pipeline/lib/http.mjs';
import { fetchShopifyShop } from '../pipeline/sources/shopify.mjs';
import { loadTables } from '../pipeline/classify.mjs';
import { assertInsidePrivate } from './build-my-pack.mjs';

const pick = (p) => ({
  id: p.id, title: p.title, handle: p.handle, vendor: p.vendor, product_type: p.product_type, tags: p.tags, options: p.options,
  images: (p.images || []).slice(0, 3).map((i) => ({ src: i.src })),
  variants: (p.variants || []).map((v) => ({ price: v.price, compare_at_price: v.compare_at_price, available: v.available })),
});

const target = 'private/raw-products.json';
assertInsidePrivate(target);
const out = {};
const shops = loadTables('config').shops.shops.filter((s) => s.platform === 'shopify');
for (const [i, shop] of shops.entries()) {
  if (i > 0) await sleep(3000);
  const r = await fetchShopifyShop(shop, { fetchJson, sleep });
  console.log(`${shop.id}: ${r.ok ? r.products.length : `FAILED ${r.error}`}`);
  if (r.ok) out[shop.id] = r.products.map(pick);
}
writeFileSync(target, JSON.stringify(out));
console.log(`wrote ${target}`);
