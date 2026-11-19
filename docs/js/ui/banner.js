import { state, swipeList } from '../app.js';
import { backupDue } from '../pack.js';
import { exportBackup } from '../backup.js';

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
  if (state.settings && backupDue({ lastBackupAt: state.lastBackupAt, swipes: swipeList() })) {
    const n = document.createElement('div');
    n.className = 'notice info';
    n.textContent = 'スワイプの記録をバックアップしよう（iCloud Drive に保存）。 ';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'linkish';
    b.textContent = '今すぐ書き出す';
    b.addEventListener('click', async () => { if (await exportBackup()) n.remove(); });
    n.append(b);
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
