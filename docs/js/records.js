// Fixing a swipe made by mistake: change its verdict, or remove it (the item can then come up again).
const VERDICTS = ['like', 'fav', 'meh'];

export function setVerdict(swipes, id, verdict) {
  if (verdict !== null && !VERDICTS.includes(verdict)) throw new Error(`unknown verdict: ${verdict}`);
  if (!swipes[id]) return swipes;
  const out = { ...swipes };
  if (verdict === null) delete out[id];
  else out[id] = { ...out[id], verdict };
  return out;
}
