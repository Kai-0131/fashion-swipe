// Builds the next stack of cards. Pure; runs on the phone.
import { genreScores, bucketOf, genreWeight, tasteProfile, tasteFactor } from './learn.js';
import { suitFactor } from './colors.js';

export const BUCKETS = ['like', 'near', 'maybe', 'challenge'];
export const RATIOS = { like: 0.6, near: 0.2, maybe: 0.15, challenge: 0.05 };
export const ITEM_SHARE = 0.7;
const RANK = { like: 0, near: 1, maybe: 2, challenge: 3 };
const SOLD_OUT_WEIGHT = 1 / 3; // still useful for learning taste, but cannot be bought

// Largest-remainder rounding so quotas always sum to n.
function quotas(n) {
  const raw = BUCKETS.map((b) => [b, n * RATIOS[b]]);
  const q = Object.fromEntries(raw.map(([b, v]) => [b, Math.floor(v)]));
  let left = n - Object.values(q).reduce((a, b) => a + b, 0);
  for (const [b] of [...raw].sort((x, y) => (y[1] % 1) - (x[1] % 1))) { if (left-- <= 0) break; q[b]++; }
  return q;
}

function pickWeighted(pool, k, rng) {
  const rest = [...pool];
  const out = [];
  while (out.length < k && rest.length) {
    const total = rest.reduce((a, c) => a + c.w, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < rest.length - 1; i++) { r -= rest[i].w; if (r <= 0) break; }
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

function fill(cands, n, rng) {
  const byBucket = Object.fromEntries(BUCKETS.map((b) => [b, cands.filter((c) => c.bucket === b)]));
  const q = quotas(n);
  const chosen = [];
  let carry = 0;
  for (const b of BUCKETS) {
    const want = q[b] + carry;
    const got = pickWeighted(byBucket[b], want, rng);
    chosen.push(...got);
    byBucket[b] = byBucket[b].filter((c) => !got.includes(c));
    carry = want - got.length;
  }
  if (carry > 0) chosen.push(...pickWeighted(BUCKETS.flatMap((b) => byBucket[b]), carry, rng));
  return chosen;
}

// Random order, never three cards of the same brand in a row (when avoidable).
function arrange(cards, rng) {
  const rest = [...cards];
  const out = [];
  while (rest.length) {
    const brandOf = (c) => c.data.brand ?? null;
    const blocked = out.length >= 2 && brandOf(out.at(-1)) !== null && brandOf(out.at(-1)) === brandOf(out.at(-2)) ? brandOf(out.at(-1)) : undefined;
    const ok = rest.filter((c) => brandOf(c) !== blocked);
    let from = ok.length ? ok : rest;
    // If one brand would be left over in a clump at the end, place it now.
    const counts = new Map();
    for (const c of rest) if (brandOf(c) !== null) counts.set(brandOf(c), (counts.get(brandOf(c)) ?? 0) + 1);
    const [topBrand, topN] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    if (topBrand !== null && topBrand !== blocked && topN > 2 * (rest.length - topN)) from = from.filter((c) => brandOf(c) === topBrand);
    const c = from[Math.floor(rng() * from.length)];
    rest.splice(rest.indexOf(c), 1);
    out.push(c);
  }
  return out;
}

export function buildDeck({ items = [], looks = [], swipes = [], settings = null, genres, rng = Math.random, size = 20, genreFixes = {} }) {
  const scores = genreScores(swipes);
  const seen = new Set(swipes.map((s) => s.itemId));
  const slimPenalty = settings?.slimPenalty ?? 1;
  const taste = tasteProfile(swipes);

  const toCand = (kind) => (data) => {
    const gs = genreFixes[data.id] ?? data.genres ?? [];
    const bucket = gs.length ? gs.map((g) => bucketOf(g, scores, settings, genres)).sort((a, b) => RANK[a] - RANK[b])[0] : (settings ? 'challenge' : 'maybe');
    const w = (gs.length ? Math.max(...gs.map((g) => genreWeight(g, scores))) : 1) * (data.slim ? slimPenalty : 1)
      * (kind === 'item' ? suitFactor(data, settings) * tasteFactor(data, taste) : 1)
      * (data.soldOut ? SOLD_OUT_WEIGHT : 1);
    return { kind, data, bucket, w };
  };
  const itemC = items.filter((i) => !seen.has(i.id) && i.images?.length).map(toCand('item'));
  const lookC = looks.filter((l) => !seen.has(l.id) && (l.image || l.permalink)).map(toCand('look'));

  let nItems = Math.round(size * ITEM_SHARE);
  let nLooks = size - nItems;
  if (lookC.length < nLooks) { nItems += nLooks - lookC.length; nLooks = lookC.length; }
  if (itemC.length < nItems) { nLooks = Math.min(lookC.length, nLooks + nItems - itemC.length); nItems = itemC.length; }

  const chosen = [...fill(itemC, nItems, rng), ...fill(lookC, nLooks, rng)];
  return arrange(chosen, rng).map(({ kind, data, bucket }) => ({ kind, data, bucket }));
}
