// Shopify product -> compact Item (url/shopName are added on the phone from shops.json), or null when it is not men's clothing we can show.
import { classify, matchesAny, kindOf } from './classify.mjs';

const MAX_IMAGES = 3;

const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function normalizeShopify(product, shop, tables, now) {
  const kw = tables.keywords;
  const id = `shopify:${shop.id}:${product.id}`;
  const judged = tables.judgments?.[id];
  if (judged?.x) return null;
  const tags = Array.isArray(product.tags) ? product.tags : String(product.tags || '').split(',');
  const textAll = [product.title, product.product_type, ...tags].join(' | ');
  if (matchesAny(textAll, kw.exclude, kw.phraseFixes)) return null;
  if (matchesAny(textAll, kw.women, kw.phraseFixes) || /\sW$/.test(product.title || '')) return null;

  // Lighters, vases, pillows...: dropped unless the title also names something worn or carried.
  if (!kindOf(product.title, kw) && matchesAny(product.title, kw.nonFashion ?? [], kw.phraseFixes)) return null;

  const images = (product.images || []).map((i) => i?.src?.split('?')[0]).filter(Boolean).slice(0, MAX_IMAGES);
  if (images.length === 0) return null;

  const variants = product.variants || [];
  const variant = variants.find((v) => v.available !== false) ?? variants[0];
  const price = num(variant?.price);
  if (price === null) return null;
  const cmp = num(variant?.compare_at_price);
  const compareAt = cmp !== null && cmp > price ? cmp : null;

  const prefix = (shop.vendorPrefixes ?? []).find((p) => product.vendor?.startsWith(p));
  const vendor = prefix ? product.vendor.slice(prefix.length) : product.vendor;
  const brand = shop.vendorAliases?.[vendor] ?? (vendor || shop.name);
  const tagsOut = classify({
    brand, title: product.title, productType: product.product_type, tags,
    options: product.options || [], shopGenres: shop.genres,
  }, tables);

  return {
    id,
    source: 'shopify',
    shopId: shop.id,
    brand,
    title: product.title,
    handle: product.handle,
    images,
    price,
    compareAt,
    currency: shop.currency,
    ...tagsOut,
    ...(judged ? { genres: judged.g, kind: judged.k } : {}),
  };
}
