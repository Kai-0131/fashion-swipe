// Reads a Shopify shop's public product list page by page.
// Any failure fails the whole shop: partial data is never used.
const PAGE_GAP_MS = 3000;
const DEFAULT_MAX_PAGES = 4; // up to 1000 products per shop

export async function fetchShopifyShop(shop, { fetchJson, sleep }) {
  const maxPages = shop.maxPages ?? DEFAULT_MAX_PAGES;
  const products = [];
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await sleep(PAGE_GAP_MS);
    const r = await fetchJson(`https://${shop.domain}/products.json?limit=250&page=${page}`);
    if (!r.ok) return { ok: false, products: null, error: r.error };
    if (!Array.isArray(r.json?.products)) return { ok: false, products: null, error: 'bad_shape' };
    if (r.json.products.length === 0) {
      if (page === 1) return { ok: false, products: null, error: 'empty' }; // a shop hiding its list must not wipe yesterday's items
      break;
    }
    products.push(...r.json.products);
  }
  return { ok: true, products, error: null };
}
