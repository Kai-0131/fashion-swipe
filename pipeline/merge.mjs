// Combine today's results with the previous snapshot, safely.
// A failed source keeps yesterday's items; a big drop in total aborts the save.
const MIN_RATIO = 0.5;
const keyOf = (item) => item.shopId ?? item.source;

export function mergeSnapshot(prev, results, now, { keepOthers = false } = {}) {
  const prevItems = prev?.items ?? [];
  const bySource = new Map();
  for (const it of prevItems) {
    const k = keyOf(it);
    if (!bySource.has(k)) bySource.set(k, []);
    bySource.get(k).push(it);
  }

  // The day an item first showed up, so the phone can show new arrivals more often.
  // Nothing is marked on the first run or for a shop seen for the first time (that would flood the deck).
  const prevById = new Map(prevItems.map((it) => [it.id, it]));
  const today = String(now).slice(0, 10);
  const withFirstSeen = (r) => r.items.map((it) => {
    const before = prevById.get(it.id);
    const firstSeen = before ? before.firstSeen : bySource.has(r.sourceId) ? today : undefined;
    return firstSeen ? { ...it, firstSeen } : it;
  });

  const sources = {};
  const out = [];
  const touched = new Set();
  for (const r of results) {
    touched.add(r.sourceId);
    if (r.ok) {
      out.push(...withFirstSeen(r));
      sources[r.sourceId] = { ok: true, count: r.items.length };
    } else {
      const kept = bySource.get(r.sourceId) ?? [];
      out.push(...kept);
      sources[r.sourceId] = { ok: false, count: kept.length, error: r.error ?? 'unknown', stale: true };
    }
  }
  if (keepOthers) {
    for (const [k, items] of bySource) if (!touched.has(k)) out.push(...items);
  }

  const byId = new Map();
  for (const it of out) byId.set(it.id, it);
  const items = [...byId.values()];
  const snapshot = { updatedAt: now, items, sources };

  if (items.length === 0) return { snapshot, abort: true, reason: 'total is 0 items' };
  if (prevItems.length > 0 && items.length < prevItems.length * MIN_RATIO) {
    return { snapshot, abort: true, reason: `total ${items.length} < 50% of previous ${prevItems.length}` };
  }
  return { snapshot, abort: false, reason: null };
}
