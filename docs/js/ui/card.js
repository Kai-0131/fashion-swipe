// One swipe card (item or look).
import { faceBadge, faceLabel, matchColors, COLOR_LABELS } from '../colors.js';
import { formatPrice, thumb } from '../format.js';
import { BUCKET_JA, genreName, effectiveGenres, state } from '../app.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export function colorDots(ids) {
  const row = el('div', 'dots');
  for (const id of ids) {
    const d = el('span', 'dot');
    const i = el('i');
    i.style.background = COLOR_LABELS[id]?.hex ?? '#999';
    d.append(i, document.createTextNode(COLOR_LABELS[id]?.ja ?? id));
    row.append(d);
  }
  return row;
}

let igLoaded = false;
function loadInstagram() {
  if (igLoaded) { window.instgrm?.Embeds?.process(); return; }
  igLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.instagram.com/embed.js';
  document.body.append(s);
}

export function renderCard(card, { onImageError, onImageLoad, onFix } = {}) {
  const { kind, data, bucket } = card;
  const root = el('article', 'card');
  root.dataset.id = data.id;
  const ph = el('div', 'ph');

  if (data.image || data.images?.length) {
    const img = el('img');
    img.alt = data.title ?? 'コーデの写真';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = data.image ?? thumb(data.images[0], 800);
    img.addEventListener('error', () => onImageError?.(card), { once: true });
    img.addEventListener('load', () => onImageLoad?.(card), { once: true });
    ph.append(img);
  } else if (data.permalink) {
    const wrap = el('div', 'embed-wrap');
    const bq = el('blockquote', 'instagram-media');
    bq.dataset.instgrmPermalink = data.permalink;
    bq.dataset.instgrmVersion = '14';
    const a = el('a', null, 'Instagram で見る');
    a.href = data.permalink;
    bq.append(a);
    wrap.append(bq);
    ph.append(wrap, el('div', 'embed-shield'));
    queueMicrotask(loadInstagram);
  }
  for (const [k, t] of [['like', '好き'], ['meh', '普通'], ['fav', 'お気に入り']]) ph.append(el('span', `stamp ${k}`, t));

  const info = el('div', 'info');
  const genres = effectiveGenres(data);
  if (kind === 'item') {
    const top = el('div', 'row');
    top.append(el('span', 'brand', data.brand));
    if (data.vintage) top.append(el('span', 'tag', '古着'));
    info.append(top, el('div', 'title', data.title));
    const price = el('div', 'price', formatPrice(data.price, data.currency));
    if (data.compareAt) price.append(el('s', null, formatPrice(data.compareAt, data.currency)));
    info.append(price);
    const badge = faceBadge(data, state.settings);
    if (badge) info.append(el('div', `badge ${badge}`, faceLabel(badge, state.settings)));
    const mc = matchColors(data.colors, state.pairs, state.settings);
    if (mc.length) {
      const line = el('div', 'row');
      line.append(el('span', 'muted', '合う色:'), colorDots(mc));
      info.append(line);
    }
  } else if (data.credit) {
    const c = el('div', 'credit');
    c.append(document.createTextNode('Photo: '));
    const a = el('a', null, data.credit.name);
    a.href = data.credit.url;
    a.target = '_blank';
    a.rel = 'noopener';
    c.append(a, document.createTextNode(data.source === 'pexels' ? '（Pexels）' : ''));
    info.append(c);
  }
  const g = el('div', 'row');
  g.append(el('span', null, genres.map(genreName).join('・') || 'ジャンル不明'), el('span', 'tag', BUCKET_JA[bucket] ?? ''));
  const fix = el('button', 'fix', 'ジャンル違う');
  fix.type = 'button';
  fix.addEventListener('pointerdown', (e) => e.stopPropagation());
  fix.addEventListener('click', (e) => { e.stopPropagation(); onFix?.(card); });
  g.append(fix);
  info.append(g);

  root.append(ph, info);
  return root;
}
