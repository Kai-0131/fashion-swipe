// Shops and people ranked by how well their genres match your likes.
import { state, scoringSwipes, genreName } from '../app.js';
import { genreScores } from '../learn.js';
import { mapsLink } from '../similar.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const ext = (href, text) => { const a = el('a', null, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };

function rank(list) {
  const scores = genreScores(scoringSwipes());
  const liked = new Set(state.settings?.likedGenres ?? []);
  const fit = (gs) => gs.reduce((a, g) => a + Math.max(0, (scores[g]?.likes ?? 0) + 2 * (scores[g]?.favs ?? 0)) + (liked.has(g) ? 3 : 0), 0);
  return list.map((x, i) => ({ x, i, s: fit(x.genres ?? []) })).sort((a, b) => b.s - a.s || a.i - b.i).map(({ x }) => x);
}

function shopRow(s, link, linkText) {
  const r = el('div', 'li');
  r.style.gridTemplateColumns = '1fr';
  const t = el('div');
  const name = el('div', 'brand');
  name.append(document.createTextNode(s.name));
  if (s.vintage) { name.append(' '); name.append(el('span', 'tag', '古着')); }
  t.append(name, el('div', 'muted', (s.genres ?? []).map(genreName).join('・')));
  const p = el('div', 'links');
  p.append(ext(link, linkText));
  t.append(p);
  r.append(t);
  return r;
}

export function renderShops(view) {
  const shops = rank(state.shops);
  const site = (s) => s.linkUrl ?? `https://${s.domain}/`;
  const vancouver = shops.filter((s) => s.store?.city === 'Vancouver');
  const japan = shops.filter((s) => s.country === 'JP');
  const online = shops.filter((s) => s.country !== 'JP');

  view.append(el('h2', null, 'バンクーバーの実店舗'));
  const v = el('div', 'list');
  for (const s of vancouver) v.append(shopRow(s, mapsLink(s.store.mapsQuery), '地図で開く'));
  view.append(v);

  view.append(el('h2', null, 'オンライン（海外・カナダ）'));
  const o = el('div', 'list');
  for (const s of online) o.append(shopRow(s, site(s), 'サイトを開く'));
  view.append(o);

  view.append(el('h2', null, '日本'));
  const j = el('div', 'list');
  for (const s of japan) j.append(shopRow(s, site(s), 'サイトを開く'));
  view.append(j);

  view.append(el('h2', null, 'お手本の人'));
  if (state.people.length === 0) view.append(el('p', 'muted', 'まだ一覧がありません。'));
  const pl = el('div', 'list');
  for (const p of rank(state.people)) {
    const r = el('div', 'li');
    r.style.gridTemplateColumns = '1fr';
    const t = el('div');
    t.append(el('div', 'brand', p.name), el('div', 'muted', (p.genres ?? []).map(genreName).join('・')));
    if (p.note) t.append(el('div', 't', p.note));
    const links = el('div', 'links');
    links.append(ext(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.search ?? p.name)}`, '画像で見る'));
    if (p.instagram) links.append(ext(`https://www.instagram.com/${p.instagram}/`, `@${p.instagram}`));
    for (const [i, post] of (p.posts ?? []).entries()) links.append(ext(post, `投稿 ${i + 1}`));
    t.append(links);
    r.append(t);
    pl.append(r);
  }
  view.append(pl);
}
