import { state } from '../app.js';

const STALE_MS = 48 * 3600 * 1000;

export function staleInfo(updatedAt, now = Date.now()) {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t) || now - t <= STALE_MS) return null;
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function renderBanner(el) {
  el.replaceChildren();
  const stale = staleInfo(state.status?.updatedAt);
  if (stale) {
    const n = document.createElement('div');
    n.className = 'notice warn';
    n.textContent = `データの更新が止まっています（最終更新: ${stale}）。GitHub の自動実行を確かめてください。`;
    el.append(n);
  }
  if (!state.settings && (location.hash === '' || location.hash.startsWith('#swipe'))) {
    const n = document.createElement('div');
    n.className = 'notice info';
    n.innerHTML = '自分の設定ファイルを取り込むと、似合う印と好みの割合が使えます。 ';
    const a = document.createElement('a');
    a.href = '#settings';
    a.textContent = '取り込む';
    n.append(a);
    el.append(n);
  }
}
