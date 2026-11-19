// Similar items from today's data, and search links to other shops.
const KIND_EN = { top: 'shirt', bottom: 'pants', outer: 'jacket', shoes: 'shoes', accessory: '', other: '' };

export function similarItems(item, items, n = 6) {
  const gs = new Set(item.genres ?? []);
  const cs = new Set(item.colors ?? []);
  const overlap = (x) => (x.colors ?? []).filter((c) => cs.has(c)).length;
  return items
    .filter((x) => x.id !== item.id && x.kind === item.kind && (x.genres ?? []).some((g) => gs.has(g)))
    .map((x, i) => ({ x, i, o: overlap(x) }))
    .sort((a, b) => b.o - a.o || a.i - b.i)
    .slice(0, n)
    .map(({ x }) => x);
}

export function searchKeyword(item) {
  return `${item.brand ?? ''} ${KIND_EN[item.kind] ?? ''}`.trim();
}

export function searchLinks(item) {
  const q = encodeURIComponent(searchKeyword(item));
  return [
    { label: 'メルカリ', url: `https://jp.mercari.com/search?keyword=${q}` },
    { label: 'Grailed', url: `https://www.grailed.com/shop?query=${q}` },
    { label: 'eBay', url: `https://www.ebay.ca/sch/i.html?_nkw=${q}` },
    { label: 'SSENSE', url: `https://www.ssense.com/en-ca/men?q=${q}` },
    { label: 'ZOZOTOWN', url: `https://store.shopping.yahoo.co.jp/zozo/search.html?p=${q}` },
  ];
}

export function mapsLink(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
