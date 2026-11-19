// Objective tagging: genre, kind, colors, slim. No personal preferences here.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MAX_GENRES = 3;
const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);

export function loadTables(dir = 'config') {
  const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return {
    shops: read('shops.json'),
    genres: read('genres.json'),
    brands: read('brands.json'),
    keywords: read('keywords.json'),
    colors: read('colors.json'),
    pexelsQueries: read('pexels-queries.json'),
    people: read('people.json'),
    // Claude's one-by-one genre/kind decisions, keyed by item id. Items not in it use the rules.
    judgments: existsSync(join(dir, 'item-judgments.json')) ? read('item-judgments.json') : {},
  };
}

export function normBrand(s = '') {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const singular = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

// Prepared text: lowercase + phrase fixes, plus a padded string of singular ASCII tokens.
function prep(text, phraseFixes) {
  let s = (text || '').normalize('NFKC').toLowerCase();
  for (const [from, to] of Object.entries(phraseFixes)) s = s.split(from).join(to);
  const tokens = s.split(/[^a-z0-9'\-]+/).filter(Boolean).map(singular);
  return { raw: s, padded: ` ${tokens.join(' ')} ` };
}

function has(p, word) {
  if (!isAscii(word)) return p.raw.includes(word);
  const w = word.split(' ').map(singular).join(' ');
  return p.padded.includes(` ${w} `);
}

export function matchesAny(text, words, phraseFixes = {}) {
  const p = prep(text, phraseFixes);
  return words.some((w) => has(p, w));
}

export function kindOf(text, kw) {
  const p = prep(text, kw.phraseFixes);
  for (const kind of kw.kindOrder) if (kw.kinds[kind].some((w) => has(p, w))) return kind;
  return null;
}

// Longest color phrase first; a matched phrase is removed so "washed black" does not also add "black".
function colorsIn(text, words) {
  let raw = ` ${(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\-]+/gu, ' ')} `;
  const found = [];
  for (const w of Object.keys(words).sort((a, b) => b.length - a.length)) {
    const needle = isAscii(w) ? ` ${w} ` : w;
    if (raw.includes(needle)) {
      if (!found.includes(words[w])) found.push(words[w]);
      raw = raw.split(needle).join(' ');
    }
  }
  return found;
}

export function classify({ brand, title, productType, tags = [], options = [], shopGenres = [] }, tables) {
  const kw = tables.keywords;
  const kind = kindOf(title, kw) ?? kindOf(productType, kw) ?? 'other';

  const genres = [];
  const add = (gs) => { for (const g of gs || []) if (!genres.includes(g)) genres.push(g); };
  add(tables.brands[normBrand(brand)]);
  const p = prep(title, kw.phraseFixes);
  for (const [word, gs] of Object.entries(kw.genres)) if (has(p, word)) add(gs);
  if (genres.length === 0) add(shopGenres);

  let colors = colorsIn(title, tables.colors.words);
  if (colors.length === 0) {
    const opt = options.find((o) => /colou?r|カラー|色/i.test(o?.name || ''));
    const values = opt?.values || [];
    if (values.length === 1) colors = colorsIn(values[0], tables.colors.words);
  }

  return { genres: genres.slice(0, MAX_GENRES), kind, colors, slim: kw.slim.some((w) => has(p, w)) };
}
