// Builds private/my-pack.json (settings + collected photos) for importing on the phone.
// Never writes outside private/ — this file holds personal data and must not reach the public repo.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

export function assertInsidePrivate(path) {
  const p = resolve(path);
  if (!p.startsWith(resolve('private') + sep)) throw new Error(`refusing to write outside private/: ${path}`);
}

export function buildPack({ settings, photos, readFile = readFileSync, root = 'private' }) {
  const out = photos.map((p) => ({
    id: p.id,
    genres: p.genres,
    dataUrl: `data:image/jpeg;base64,${Buffer.from(readFile(join(root, p.file))).toString('base64')}`,
  }));
  return JSON.stringify({ kind: 'fashion-swipe-pack', version: 1, settings, photos: out });
}

if (process.argv[1]?.endsWith('build-my-pack.mjs')) {
  const settings = JSON.parse(readFileSync('private/my-settings.json', 'utf8'));
  const { photos } = JSON.parse(readFileSync('private/photos.json', 'utf8'));
  const target = 'private/my-pack.json';
  assertInsidePrivate(target);
  const text = buildPack({ settings, photos });
  writeFileSync(target, text);
  console.log(`wrote ${target}: ${photos.length} photos, ${(text.length / 1e6).toFixed(1)} MB`);
}
