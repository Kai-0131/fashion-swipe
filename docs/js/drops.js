// Price drops among liked/favourite items, compared on the phone. Different currency = no comparison.
export function priceDrops(swipes, itemsById) {
  const out = [];
  for (const s of swipes) {
    if (s.kind !== 'item' || (s.verdict !== 'like' && s.verdict !== 'fav')) continue;
    const now = itemsById.get(s.itemId);
    if (!now) {
      out.push({ itemId: s.itemId, was: s.priceAtSave, now: null, compareAt: null, currency: s.currency, gone: true });
      continue;
    }
    if (now.currency !== s.currency) continue;
    const lower = s.priceAtSave != null && now.price < s.priceAtSave;
    const onSale = now.compareAt != null && now.compareAt > now.price;
    if (lower || onSale) out.push({ itemId: s.itemId, was: s.priceAtSave, now: now.price, compareAt: now.compareAt, currency: now.currency, gone: false });
  }
  return out;
}
