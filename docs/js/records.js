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

// Why a swipe went the way it did: color and/or shape, +1 liked or -1 disliked. The same tap again clears it.
const AXES = ['color', 'shape'];
export function toggleReason(reasons, axis, value) {
  if (!AXES.includes(axis)) throw new Error(`unknown reason: ${axis}`);
  if (value !== 1 && value !== -1) throw new Error(`reason must be 1 or -1: ${value}`);
  const out = { ...reasons };
  if (out[axis] === value) delete out[axis];
  else out[axis] = value;
  return out;
}

export function setReason(swipes, id, axis, value) {
  const reasons = toggleReason(swipes[id]?.reasons, axis, value);
  if (!swipes[id]) return swipes;
  const rec = { ...swipes[id] };
  if (Object.keys(reasons).length) rec.reasons = reasons;
  else delete rec.reasons;
  return { ...swipes, [id]: rec };
}
