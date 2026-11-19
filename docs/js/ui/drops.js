// Price drops among favourites and likes; items no longer listed go to the bottom.
import { state, swipeList } from '../app.js';
import { priceDrops } from '../drops.js';
import { formatPrice } from '../format.js';
import { itemRow } from './detail.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function renderDrops(view) {
  const drops = priceDrops(swipeList(), state.itemsById);
  const down = drops.filter((d) => !d.gone);
  const gone = drops.filter((d) => d.gone);
  const when = state.status?.updatedAt ? new Date(state.status.updatedAt).toLocaleString('ja-JP') : '不明';
  view.append(el('p', 'muted', `最終更新: ${when}`));

  view.append(el('h2', null, `値下がり・セール中（${down.length}）`));
  if (down.length === 0) view.append(el('p', 'muted', 'お気に入りと好きの中で、値下がりした物はまだありません。'));
  const list = el('div', 'list');
  for (const d of down) {
    const it = state.itemsById.get(d.itemId);
    const sub = d.was != null && d.now < d.was
      ? `${formatPrice(d.was, d.currency)} → ${formatPrice(d.now, d.currency)}`
      : `セール中 ${formatPrice(d.now, d.currency)}（元 ${formatPrice(d.compareAt, d.currency)}）`;
    list.append(itemRow(it, sub));
  }
  view.append(list);

  view.append(el('h2', null, `今日の一覧に無い物（${gone.length}）`));
  const g = el('div', 'list');
  for (const d of gone) {
    const s = state.swipes[d.itemId];
    const it = { id: d.itemId, brand: s.snapshot.brand, title: s.snapshot.title, images: [s.snapshot.image].filter(Boolean) };
    const day = new Date(s.at);
    g.append(itemRow(it, `最後に見た値段 ${formatPrice(d.was, d.currency) || '不明'}（${day.getMonth() + 1}/${day.getDate()}）・お店で確かめてください`));
  }
  view.append(g);
}
