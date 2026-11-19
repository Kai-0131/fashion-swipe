// Expand compact items with shop info, and format prices.
export function hydrateItems(items, shops) {
  const byId = new Map(shops.map((s) => [s.id, s]));
  const out = [];
  for (const it of items) {
    if (it.url) { out.push(it); continue; }
    const s = byId.get(it.shopId);
    if (!s?.domain) continue;
    out.push({ ...it, url: `https://${s.domain}/products/${it.handle}`, shopName: s.name, vintage: Boolean(s.vintage) });
  }
  return out;
}

// Photo addresses of one shop share a long folder part; store it once per shop (imageBase).
const folderOf = (url) => url.slice(0, url.lastIndexOf('/') + 1);
export function packImages(items) {
  const imageBase = {};
  for (const it of items) {
    for (const url of it.images ?? []) {
      let p = imageBase[it.shopId] ?? folderOf(url);
      while (!url.startsWith(p)) p = folderOf(p.slice(0, -1));
      imageBase[it.shopId] = p;
    }
  }
  return {
    imageBase,
    items: items.map((it) => (it.images ? { ...it, images: it.images.map((u) => u.slice(imageBase[it.shopId].length)) } : it)),
  };
}

export function unpackImages({ items, imageBase }) {
  if (!imageBase) return items;
  return items.map((it) => {
    const base = imageBase[it.shopId];
    return base && it.images ? { ...it, images: it.images.map((s) => base + s) } : it;
  });
}

// Fixed symbols so every browser shows the same thing (ja-JP Intl gives a full-width yen).
const SYMBOL = { JPY: '¥', CAD: 'CA$', USD: 'US$', GBP: '£', EUR: '€' };
export function formatPrice(value, currency) {
  if (value == null || !currency) return '';
  const digits = currency === 'JPY' ? 0 : 2;
  const n = Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOL[currency] ?? `${currency} `}${n}`;
}

// Shopify's image server resizes on request; other hosts are left as they are.
export function thumb(url, width) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== 'cdn.shopify.com') return url;
    u.searchParams.set('width', String(width));
    return u.toString();
  } catch { return url; }
}
