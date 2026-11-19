// Library: favourites, likes, own collected photos, and a genre bar chart.
import { state, swipeList, scoringSwipes, genreName, KIND_JA } from '../app.js';
import { genreScores } from '../learn.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
let filter = { genre: null, kind: null };

function cell(imgSrc, label, onClick) {
  const b = el('button', 'cell');
  b.type = 'button';
  if (imgSrc) { const i = el('img'); i.src = imgSrc; i.alt = label ?? ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; b.append(i); }
  if (label) b.append(el('span', 'mark', label));
  b.addEventListener('click', onClick);
  return b;
}

function chipRow(options, current, onPick) {
  const row = el('div', 'seg');
  for (const [value, label] of [[null, 'すべて'], ...options]) {
    const c = el('button', 'chip', label);
    c.type = 'button';
    c.setAttribute('aria-pressed', String(current === value));
    c.addEventListener('click', () => onPick(value));
    row.append(c);
  }
  return row;
}

export function renderLibrary(view) {
  const swipes = swipeList().filter((s) => s.verdict !== 'meh').sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const pass = (s) => (!filter.genre || (s.snapshot?.genres ?? []).includes(filter.genre)) && (!filter.kind || s.snapshot?.kind === filter.kind);

  view.append(el('h2', null, '好きなジャンルの割合'));
  const scores = genreScores(scoringSwipes());
  const rows = Object.entries(scores).map(([g, e]) => [g, e.likes + e.favs * 2]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) view.append(el('p', 'muted', 'まだ記録がありません。スワイプで「好き」「お気に入り」を付けるとここに出ます。'));
  const bars = el('div', 'bars');
  const max = rows[0]?.[1] ?? 1;
  for (const [g, v] of rows) {
    const r = el('div', 'bar');
    const track = el('div', 'track');
    const fill = el('div', 'fill');
    fill.style.width = `${Math.round((v / max) * 100)}%`;
    track.append(fill);
    r.append(el('span', null, genreName(g)), track, el('span', 'n', String(v)));
    bars.append(r);
  }
  view.append(bars);

  const usedGenres = [...new Set(swipes.flatMap((s) => s.snapshot?.genres ?? []))].map((g) => [g, genreName(g)]);
  const usedKinds = [...new Set(swipes.map((s) => s.snapshot?.kind).filter(Boolean))].map((k) => [k, KIND_JA[k] ?? k]);
  const rerender = () => { view.replaceChildren(); renderLibrary(view); };
  if (usedGenres.length) view.append(chipRow(usedGenres, filter.genre, (v) => { filter.genre = v; rerender(); }));
  if (usedKinds.length) view.append(chipRow(usedKinds, filter.kind, (v) => { filter.kind = v; rerender(); }));

  for (const [verdict, title] of [['fav', 'お気に入り'], ['like', '好き']]) {
    const list = swipes.filter((s) => s.verdict === verdict && pass(s));
    view.append(el('h2', null, `${title}（${list.length}）`));
    const grid = el('div', 'grid');
    for (const s of list) {
      grid.append(cell(s.snapshot?.image, s.kind === 'look' ? 'コーデ' : s.snapshot?.brand, () => {
        if (s.kind === 'item') location.hash = `#detail/${encodeURIComponent(s.itemId)}`;
        else if (s.snapshot?.url) window.open(s.snapshot.url, '_blank', 'noopener');
      }));
    }
    view.append(grid);
  }

  const mine = state.myPhotos.filter((p) => !filter.genre || (p.genres ?? []).includes(filter.genre));
  view.append(el('h2', null, `自分で集めた（${mine.length}）`));
  if (state.myPhotos.length === 0) view.append(el('p', 'muted', '設定ファイルを取り込むと、前に集めた写真がここに入ります。'));
  const grid = el('div', 'grid');
  for (const p of mine) {
    const url = p.photo instanceof Blob ? URL.createObjectURL(p.photo) : p.photo;
    grid.append(cell(url, (p.genres ?? []).map(genreName)[0], () => window.open(url, '_blank')));
  }
  view.append(grid);
}
