// Detail of one item: photos, shop link, similar items, search links, matching owned clothes.
import { state, genreName, effectiveGenres } from '../app.js';
import { faceBadge, faceLabel, matchColors } from '../colors.js';
import { similarItems, searchLinks } from '../similar.js';
import { closetMatches } from '../closet-match.js';
import { formatPrice, thumb } from '../format.js';
import { colorDots } from './card.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const ext = (href, text) => { const a = el('a', null, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };

export function itemRow(it, sub) {
  const a = el('a', 'li');
  a.href = `#detail/${encodeURIComponent(it.id)}`;
  const img = el('img');
  img.src = thumb(it.images?.[0], 300) ?? it.image ?? '';
  img.alt = it.title ?? '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  const t = el('div');
  t.append(el('div', 'brand', it.brand ?? ''), el('div', 't', it.title ?? ''), el('div', 'muted', sub ?? formatPrice(it.price, it.currency)));
  a.append(img, t);
  return a;
}

export function renderDetail(view, id) {
  const back = el('button', 'btn', '← 戻る');
  back.addEventListener('click', () => history.back());
  view.append(back);

  const live = state.itemsById.get(id);
  const saved = state.swipes[id];
  const it = live ?? (saved && { id, ...saved.snapshot, images: saved.snapshot.image ? [saved.snapshot.image] : [], price: saved.priceAtSave, currency: saved.currency });
  if (!it) { view.append(el('p', 'empty', 'この商品は見つかりませんでした。')); return; }
  if (!live) view.append(el('div', 'notice warn', `この商品は今日の一覧にありません（最後に見た値段: ${formatPrice(saved.priceAtSave, saved.currency) || '不明'}）。売り切れか、取得の範囲から外れた可能性があります。`));

  const gal = el('div', 'gallery');
  for (const src of it.images ?? []) { const i = el('img'); i.src = thumb(src, 1000); i.alt = it.title ?? ''; i.referrerPolicy = 'no-referrer'; gal.append(i); }
  view.append(gal);

  const head = el('div');
  head.style.marginTop = '10px';
  head.append(el('div', 'brand', it.brand ?? ''), el('div', null, it.title ?? ''));
  const price = el('div', 'price', formatPrice(it.price, it.currency));
  if (it.compareAt) price.append(el('s', null, formatPrice(it.compareAt, it.currency)));
  head.append(price);
  const badge = faceBadge(it, state.settings);
  if (badge) head.append(el('div', `badge ${badge}`, faceLabel(badge, state.settings)));
  const mc = matchColors(it.colors ?? [], state.pairs, state.settings);
  if (mc.length) { const r = el('div', 'row'); r.append(el('span', 'muted', '合う色:'), colorDots(mc)); head.append(r); }
  head.append(el('div', 'muted', effectiveGenres(it).map(genreName).join('・')));
  if (it.url) { const p = el('p'); p.append(ext(it.url, `${it.shopName ?? 'お店'}で見る →`)); head.append(p); }
  view.append(head);

  const sims = live ? similarItems(live, state.items) : [];
  if (sims.length) {
    view.append(el('h2', null, '似た商品'));
    const list = el('div', 'list');
    for (const s of sims) list.append(itemRow(s, `${s.shopName} ・ ${formatPrice(s.price, s.currency)}`));
    view.append(list);
  }

  view.append(el('h2', null, 'ほかのお店で探す'));
  const links = el('div', 'links');
  for (const l of searchLinks(it)) links.append(ext(l.url, l.label));
  view.append(links);

  view.append(el('h2', null, '合わせられる手持ち'));
  const mine = closetMatches(it, state.closet, state.pairs);
  if (mine.length === 0) view.append(el('p', 'muted', state.closet.length ? '合う色の手持ちは見つかりませんでした。' : '「手持ち」で服を登録するとここに出ます。'));
  const grid = el('div', 'grid');
  for (const c of mine) {
    const b = el('div', 'cell');
    const i = el('img');
    i.src = c.photo instanceof Blob ? URL.createObjectURL(c.photo) : c.photo;
    i.alt = '手持ちの服';
    b.append(i);
    grid.append(b);
  }
  view.append(grid);
}
