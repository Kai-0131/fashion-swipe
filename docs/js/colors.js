// Face badge and matching colors. Personal color rules come only from settings (on the phone).
const FACE_KINDS = new Set(['top', 'outer']);

export const COLOR_LABELS = {
  white: { ja: '白', hex: '#f7f7f5' },
  ecru: { ja: '生成り', hex: '#ece3d0' },
  lightgray: { ja: '薄いグレー', hex: '#cfd1d4' },
  gray: { ja: 'グレー', hex: '#9a9da2' },
  charcoal: { ja: 'チャコール', hex: '#4a4d52' },
  black: { ja: '黒', hex: '#141414' },
  fadedblack: { ja: '色落ちした黒', hex: '#3a3a3c' },
  navy: { ja: '紺', hex: '#1f2a44' },
  denim: { ja: 'デニム', hex: '#3d5a80' },
  lightblue: { ja: '水色', hex: '#a9c6e0' },
  red: { ja: '赤', hex: '#b3262e' },
  burgundy: { ja: 'ボルドー', hex: '#6d1f2b' },
  brown: { ja: '茶', hex: '#6b4a32' },
  olive: { ja: 'オリーブ', hex: '#6b6b3a' },
  beige: { ja: 'ベージュ', hex: '#cdbb9c' },
  khaki: { ja: 'カーキ', hex: '#b39b6b' },
  mustard: { ja: 'マスタード', hex: '#c9a227' },
  green: { ja: '緑', hex: '#2f6b4a' },
  cream: { ja: 'クリーム', hex: '#f1e8c8' },
  multi: { ja: '柄・マルチ', hex: '#8a7fa8' },
};

export function faceBadge(item, settings) {
  if (!settings || !FACE_KINDS.has(item.kind) || !item.colors?.length) return null;
  const { near = [], far = [] } = settings.suitColors ?? {};
  if (item.colors.some((c) => far.includes(c))) return 'far';
  if (item.colors.every((c) => near.includes(c))) return 'near';
  return null;
}

export function matchColors(itemColors, pairs, settings) {
  const cands = [];
  for (const c of itemColors ?? []) for (const p of pairs[c] ?? []) if (!cands.includes(p) && !itemColors.includes(p)) cands.push(p);
  if (!settings) return cands.slice(0, 4);
  const { near = [], far = [] } = settings.suitColors ?? {};
  const ok = cands.filter((c) => !far.includes(c));
  return [...ok.filter((c) => near.includes(c)), ...ok.filter((c) => !near.includes(c))].slice(0, 4);
}
