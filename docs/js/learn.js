// Preference learning from swipes. Runs on the phone; pure functions.
const RECENT = 10;
const PROMOTE_MIN = 3;
const PROMOTE_RATE = 0.6;

export function genreScores(swipes) {
  const out = {};
  const sorted = [...swipes].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const s of sorted) {
    // A 普通 with a reason was about the color or shape, not the genre.
    if (s.verdict === 'meh' && s.reasons && Object.keys(s.reasons).length) continue;
    for (const g of s.snapshot?.genres ?? []) {
      const e = (out[g] ??= { likes: 0, favs: 0, mehs: 0, score: 0, recent: [], swiped: 0 });
      if (s.kind !== 'mine') e.swiped += s.verdict === 'meh' ? 0 : 1;
      if (s.verdict === 'like') { e.likes++; e.score += 1; }
      else if (s.verdict === 'fav') { e.favs++; e.score += 2; }
      else if (s.verdict === 'meh') { e.mehs++; e.score -= 0.5; }
      if (s.kind !== 'mine') { e.recent.push(s.verdict !== 'meh'); if (e.recent.length > RECENT) e.recent.shift(); }
    }
  }
  for (const e of Object.values(out)) e.recentRate = e.recent.length ? e.recent.filter(Boolean).length / e.recent.length : 0;
  return out;
}

// Only real swipes promote a genre; collected photos (kind "mine") feed the chart and weights only.
const promoted = (e) => Boolean(e) && e.swiped >= PROMOTE_MIN && e.recentRate >= PROMOTE_RATE;

export function likeSetOf(scores, settings) {
  const set = new Set(settings?.likedGenres ?? []);
  for (const [g, e] of Object.entries(scores)) if (promoted(e)) set.add(g);
  return set;
}

function neighborsOf(g, genres) {
  return genres.genres.find((x) => x.id === g)?.neighbors ?? [];
}

export function bucketOf(genreId, scores, settings, genres) {
  const likes = likeSetOf(scores, settings);
  if (likes.has(genreId)) return 'like';
  if (likes.size === 0) return 'maybe';
  const near = new Set([...likes].flatMap((g) => neighborsOf(g, genres)));
  if (near.has(genreId)) return 'near';
  // A hand-made "好きそう" list wins; two steps away is only a fallback when there is no list
  // (with several liked genres almost everything is two steps away and no challenge would remain).
  const listed = settings?.maybeGenres ?? [];
  if (listed.length) return listed.includes(genreId) ? 'maybe' : 'challenge';
  const twoHop = new Set([...near].flatMap((g) => neighborsOf(g, genres)));
  return twoHop.has(genreId) ? 'maybe' : 'challenge';
}

export function genreWeight(genreId, scores) {
  const mehs = scores[genreId]?.mehs ?? 0;
  return Math.max(0.2, Math.round((1 - 0.15 * mehs) * 100) / 100);
}

// Photos collected before the app count as likes (they seed the genre mix). Kind "mine" keeps them
// out of price drops and the library shelves of swiped items.
export function photoLikes(myPhotos) {
  return (myPhotos ?? []).map((p) => ({ itemId: `mine:${p.id}`, kind: 'mine', verdict: 'like', at: '0000', snapshot: { genres: p.genres ?? [] } }));
}

// Taste inside a genre: which brands, colors and kinds of shop items get liked. Outfit photos and collected photos are left out.
const VERDICT = { like: 1, fav: 2, meh: -0.5 };
export function tasteProfile(swipes) {
  const p = { brand: {}, color: {}, kind: {} };
  for (const s of swipes) {
    if (s.kind !== 'item' || !(s.verdict in VERDICT)) continue;
    const v = VERDICT[s.verdict];
    const snap = s.snapshot ?? {};
    const r = s.reasons && Object.keys(s.reasons).length ? s.reasons : null;
    // 普通 with a reason: only the named part learns (the reason says what was wrong; nothing else gets the minus).
    // 好き/欲しい with a reason: the named part follows the reason, everything else gets the plus.
    // Shape has no shop data yet, so a shape reason only decides which of the two rules applies.
    const rest = r && s.verdict === 'meh' ? 0 : v;
    const colorV = r?.color ?? rest;
    if (snap.brand && rest) p.brand[snap.brand] = (p.brand[snap.brand] ?? 0) + rest;
    if (colorV) for (const c of snap.colors ?? []) p.color[c] = (p.color[c] ?? 0) + colorV;
    if (snap.kind && rest) p.kind[snap.kind] = (p.kind[snap.kind] ?? 0) + rest;
  }
  return p;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export function tasteFactor(item, profile) {
  const b = 1 + 0.15 * clamp(profile.brand[item.brand] ?? 0, -2, 4);
  const cs = (item.colors ?? []).map((c) => clamp(profile.color[c] ?? 0, -2, 3));
  const c = 1 + 0.1 * (cs.length ? cs.reduce((a, x) => a + x, 0) / cs.length : 0);
  const k = 1 + 0.05 * clamp(profile.kind[item.kind] ?? 0, -2, 4);
  return clamp(b * c * k, 0.5, 2);
}
