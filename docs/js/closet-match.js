// Owned clothes that go with an item: a different kind in a color that pairs well.
export function closetMatches(item, closet, pairs, n = 3) {
  const good = new Set((item.colors ?? []).flatMap((c) => pairs[c] ?? []));
  if (good.size === 0) return [];
  return closet.filter((c) => c.kind !== item.kind && (c.colors ?? []).some((x) => good.has(x))).slice(0, n);
}
