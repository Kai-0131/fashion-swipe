// One-by-one genre judging, done once by Claude and saved in config/item-judgments.json.
//   node tools/judging.mjs export        -> private/judge/batch-NN.tsv (input lines) + batch-NN.ids.json
//   node tools/judging.mjs import        -> reads private/judge/out-NN.tsv, writes config/item-judgments.json
// Input line:  n <TAB> brand <TAB> title <TAB> product type <TAB> tags <TAB> shop
// Output line: n <TAB> genre1,genre2 <TAB> kind      or      n <TAB> x   (not worn or carried)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const KINDS = ['top', 'bottom', 'outer', 'shoes', 'accessory'];
const MAX_GENRES = 3;
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();

export function judgeLine(n, { brand, title, productType, tags = [], shopName }) {
  return [n, clean(brand), clean(title), clean(productType), tags.slice(0, 6).map(clean).join(','), clean(shopName)].join('\t');
}

export function parseJudgments(text, ids, genreIds) {
  const known = new Set(genreIds);
  const judgments = {};
  const errors = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [nStr, gStr = '', kind = ''] = line.split('\t').map((s) => s.trim());
    const id = ids[Number(nStr)];
    if (!/^\d+$/.test(nStr) || !id) { errors.push(`bad number: ${line}`); continue; }
    if (gStr === 'x') { judgments[id] = { x: 1 }; continue; }
    const g = gStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (g.length === 0 || g.length > MAX_GENRES || g.some((x) => !known.has(x))) { errors.push(`bad genres: ${line}`); continue; }
    if (!KINDS.includes(kind)) { errors.push(`bad kind: ${line}`); continue; }
    judgments[id] = { g, k: kind };
  }
  return { judgments, errors };
}

const BATCH = 700;
const DIR = 'private/judge';

async function exportBatches() {
  const { loadTables } = await import('../pipeline/classify.mjs');
  const { normalizeShopify } = await import('../pipeline/normalize.mjs');
  const tables = { ...loadTables('config'), judgments: {} };
  const raw = JSON.parse(readFileSync('private/raw-products.json', 'utf8'));
  const rows = [];
  for (const shop of tables.shops.shops.filter((s) => raw[s.id])) {
    for (const p of raw[shop.id]) {
      const it = normalizeShopify(p, shop, tables, '');
      if (!it) continue;
      const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',');
      rows.push({ id: it.id, info: { brand: it.brand, title: p.title, productType: p.product_type, tags, shopName: shop.name } });
    }
  }
  mkdirSync(DIR, { recursive: true });
  let b = 0;
  for (let i = 0; i < rows.length; i += BATCH, b++) {
    const part = rows.slice(i, i + BATCH);
    const nn = String(b + 1).padStart(2, '0');
    writeFileSync(join(DIR, `batch-${nn}.tsv`), part.map((r, j) => judgeLine(j, r.info)).join('\n') + '\n');
    writeFileSync(join(DIR, `batch-${nn}.ids.json`), JSON.stringify(part.map((r) => r.id)));
  }
  console.log(`${rows.length} items -> ${b} batches in ${DIR}`);
}

function importBatches() {
  const genreIds = JSON.parse(readFileSync('config/genres.json', 'utf8')).genres.map((g) => g.id);
  const all = {};
  let errors = 0;
  let missing = 0;
  for (const f of readdirSync(DIR).filter((x) => /^batch-\d+\.ids\.json$/.test(x)).sort()) {
    const nn = f.match(/\d+/)[0];
    const ids = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
    const out = join(DIR, `out-${nn}.tsv`);
    if (!existsSync(out)) { console.log(`batch ${nn}: no output yet`); missing += ids.length; continue; }
    const r = parseJudgments(readFileSync(out, 'utf8'), ids, genreIds);
    for (const e of r.errors) console.log(`batch ${nn}: ${e}`);
    errors += r.errors.length;
    const got = Object.keys(r.judgments).length;
    missing += ids.length - got;
    Object.assign(all, r.judgments);
  }
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
  const lines = Object.entries(sorted).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  writeFileSync('config/item-judgments.json', `{\n${lines.join(',\n')}\n}\n`);
  console.log(`saved ${lines.length} judgments (${errors} bad lines, ${missing} items without a judgment)`);
}

if (process.argv[1]?.endsWith('judging.mjs')) {
  const cmd = process.argv[2];
  if (cmd === 'export') await exportBatches();
  else if (cmd === 'import') importBatches();
  else console.log('usage: node tools/judging.mjs export|import');
}
