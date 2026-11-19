// Personal settings file (made on the PC, imported once) and full backups. All messages in Japanese.
const PACK_KIND = 'fashion-swipe-pack';
const BACKUP_KIND = 'fashion-swipe-backup';

function readJson(text, what) {
  try { return JSON.parse(text); } catch { throw new Error(`${what}が読めません（JSON ではありません）。`); }
}

export function validateSettings(s) {
  if (!s || s.version !== 1) throw new Error('設定ファイルの版が違います（version 1 が必要）。');
  if (!Array.isArray(s.likedGenres)) throw new Error('設定ファイルに好きなジャンル（likedGenres）がありません。');
  if (!Array.isArray(s.suitColors?.near) || !Array.isArray(s.suitColors?.far)) throw new Error('設定ファイルに似合う色（suitColors.near / far）がありません。');
  return { version: 1, likedGenres: s.likedGenres, maybeGenres: s.maybeGenres ?? [], suitColors: { near: s.suitColors.near, far: s.suitColors.far }, slimPenalty: typeof s.slimPenalty === 'number' ? s.slimPenalty : 1 };
}

export function parsePack(text) {
  const j = readJson(text, '設定ファイル');
  if (j.kind !== PACK_KIND) throw new Error('これは設定ファイルではありません。');
  if (j.version !== 1) throw new Error('設定ファイルの版が違います（version 1 が必要）。');
  const settings = validateSettings(j.settings);
  const photos = (j.photos ?? []).map((p) => {
    if (!p?.id || typeof p.dataUrl !== 'string' || !p.dataUrl.startsWith('data:image/')) throw new Error('設定ファイルの写真のデータが壊れています。');
    return { id: p.id, genres: Array.isArray(p.genres) ? p.genres : [], dataUrl: p.dataUrl };
  });
  return { settings, photos };
}

async function toDataUrl(photo) {
  if (typeof photo === 'string' || photo == null) return photo ?? null;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${photo.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

export async function makeBackup(state, now = new Date().toISOString()) {
  const withUrls = async (list) => Promise.all((list ?? []).map(async (x) => ({ ...x, photo: await toDataUrl(x.photo) })));
  return JSON.stringify({
    kind: BACKUP_KIND, version: 1, savedAt: now,
    state: {
      settings: state.settings ?? null,
      swipes: state.swipes ?? {},
      closet: await withUrls(state.closet),
      myPhotos: await withUrls(state.myPhotos),
      genreFixes: state.genreFixes ?? {},
    },
  });
}

export function parseBackup(text) {
  const j = readJson(text, 'バックアップ');
  if (j.kind !== BACKUP_KIND || j.version !== 1 || typeof j.state !== 'object') throw new Error('これはこのサイトのバックアップではありません。');
  const s = j.state;
  return {
    settings: s.settings ? validateSettings(s.settings) : null,
    swipes: s.swipes ?? {},
    closet: s.closet ?? [],
    myPhotos: s.myPhotos ?? [],
    genreFixes: s.genreFixes ?? {},
  };
}

// Remind to back up: 7+ days since the last backup with new swipes since, or never backed up and 10+ swipes.
const WEEK_MS = 7 * 24 * 3600 * 1000;
export function backupDue({ lastBackupAt, swipes, now = new Date() }) {
  if (!lastBackupAt) return swipes.length >= 10;
  const last = new Date(lastBackupAt).getTime();
  if (now.getTime() - last < WEEK_MS) return false;
  return swipes.some((s) => new Date(s.at).getTime() > last);
}
