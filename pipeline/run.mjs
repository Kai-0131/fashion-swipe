// Daily entry point. Usage: node pipeline/run.mjs [--dry-run] [--only=a,b] [--force]
// Does nothing unless FETCH_ENABLED=true (or --force for a local try).
import { readFile as fsRead, writeFile as fsWrite, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packImages, unpackImages } from '../docs/js/format.js';
import { fetchJson as realFetchJson, sleep as realSleep } from './lib/http.mjs';
import { fetchShopifyShop } from './sources/shopify.mjs';
import { loadTables } from './classify.mjs';
import { normalizeShopify } from './normalize.mjs';
import { mergeSnapshot } from './merge.mjs';
import { fetchPexelsLooks } from './sources/pexels.mjs';

const SHOP_GAP_MS = 3000;
const OUT = 'docs/data';
const CLIENT_TABLES = ['genres.json', 'colors.json', 'shops.json', 'people.json'];

// One item per line, sorted by id: small daily git diffs. Photo folders are stored once per shop.
export function serializeSnapshot({ updatedAt, sources, items }) {
  const packed = packImages(items);
  const lines = [...packed.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((i) => JSON.stringify(i));
  const head = `{"updatedAt":${JSON.stringify(updatedAt)},"sources":${JSON.stringify(sources)},"imageBase":${JSON.stringify(packed.imageBase)},"items":[`;
  return `${head}\n${lines.join(',\n')}\n]}\n`;
}

export function parseSnapshot(text) {
  const j = JSON.parse(text);
  return { ...j, items: unpackImages(j) };
}

function parseArgs(argv) {
  const only = argv.find((a) => a.startsWith('--only='));
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    only: only ? only.slice('--only='.length).split(',').filter(Boolean) : null,
  };
}

async function readJson(readFile, path) {
  try { return parseSnapshot(await readFile(path)); } catch { return null; }
}

export async function run(argv, env, deps) {
  const { fetchJson, sleep, readFile, writeFile, now, log } = deps;
  const args = parseArgs(argv);
  if (env.FETCH_ENABLED !== 'true' && !args.force) {
    log('FETCH_ENABLED is not "true"; skipping (nothing fetched, nothing written).');
    return 0;
  }

  const tables = loadTables('config');
  let shops = tables.shops.shops.filter((s) => s.platform === 'shopify');
  if (args.only) shops = shops.filter((s) => args.only.includes(s.id));
  const stamp = now();

  const results = [];
  for (const [i, shop] of shops.entries()) {
    if (i > 0) await sleep(SHOP_GAP_MS);
    const r = await fetchShopifyShop(shop, { fetchJson, sleep });
    const items = r.ok ? r.products.map((p) => normalizeShopify(p, shop, tables, stamp)).filter(Boolean) : null;
    results.push({ sourceId: shop.id, ok: r.ok, items, error: r.error });
    log(`${shop.id}: ${r.ok ? `ok ${items.length} items (${r.products.length} raw)` : `FAILED ${r.error}`}`);
  }

  const queries = tables.pexelsQueries.queries;
  const lr = await fetchPexelsLooks(queries, { fetchJson, sleep, apiKey: env.PEXELS_API_KEY });
  log(`pexels: ${lr.ok ? `ok ${lr.looks.length} looks` : `skipped (${lr.error}); previous looks kept`}`);

  const prev = await readJson(readFile, `${OUT}/items.json`);
  const { snapshot, abort, reason } = mergeSnapshot(prev, results, stamp, { keepOthers: Boolean(args.only) });
  log(`total: ${snapshot.items.length} items (previous ${prev?.items?.length ?? 0})`);
  if (abort) {
    log(`ABORT: ${reason}. Previous data kept.`);
    return 1;
  }
  if (args.dryRun) {
    log('dry run: nothing written.');
    return 0;
  }

  await writeFile(`${OUT}/items.json`, serializeSnapshot(snapshot));
  await writeFile(`${OUT}/status.json`, JSON.stringify({ updatedAt: snapshot.updatedAt, sources: snapshot.sources }, null, 2));
  if (lr.ok && lr.looks.length > 0) await writeFile(`${OUT}/looks.json`, JSON.stringify({ updatedAt: stamp, looks: lr.looks }));
  for (const f of CLIENT_TABLES) await writeFile(`${OUT}/${f}`, JSON.stringify(tables[f.replace('.json', '')]));
  log('written.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const deps = {
    fetchJson: realFetchJson,
    sleep: realSleep,
    readFile: (p) => fsRead(p, 'utf8'),
    writeFile: async (p, s) => { await mkdir(dirname(p), { recursive: true }); await fsWrite(p, s); },
    now: () => new Date().toISOString(),
    log: (m) => console.log(m),
  };
  process.exitCode = await run(process.argv.slice(2), process.env, deps);
}
