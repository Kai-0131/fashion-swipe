// Settings: import the personal file, back up / restore, status.
import { state, save, swipeList } from '../app.js';
import { parsePack, parseBackup } from '../pack.js';
import * as store from '../store.js';
import { exportBackup } from '../backup.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const toBlob = async (photo) => (typeof photo === 'string' ? (await fetch(photo)).blob() : photo);

function filePicker(label, accept, onText) {
  const wrap = el('label', 'field');
  const input = el('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (f) await onText(await f.text());
    input.value = '';
  });
  wrap.append(label, input);
  return wrap;
}

export function renderSettings(view) {
  const msg = el('p', 'notice info');
  msg.hidden = true;
  const say = (t, warn = false) => { msg.hidden = false; msg.className = `notice ${warn ? 'warn' : 'info'}`; msg.textContent = t; };

  view.append(el('h2', null, '自分の設定ファイル'));
  view.append(el('p', 'muted', state.settings ? `取り込み済み（好きなジャンル ${state.settings.likedGenres.length} 個・写真 ${state.myPhotos.length} 枚）` : 'まだ取り込んでいません。PC で作った my-pack.json を選んでください。'));
  view.append(filePicker('設定ファイルを選ぶ', '.json,application/json', async (text) => {
    try {
      const { settings, photos } = parsePack(text);
      state.settings = settings;
      state.myPhotos = await Promise.all(photos.map(async (p) => ({ id: p.id, genres: p.genres, photo: await toBlob(p.dataUrl) })));
      await save('settings');
      await save('myPhotos');
      state.prefsVersion++;
      say(`取り込みました（写真 ${photos.length} 枚）。`);
    } catch (e) { say(e.message, true); }
  }));

  view.append(el('h2', null, 'バックアップ'));
  view.append(el('p', 'muted', 'スワイプ・お気に入り・手持ち・設定を1つのファイルに書き出します。iPhone では出てきた画面で「ファイルに保存」→ iCloud Drive を選ぶと、消えた時に戻せます。データを消されにくくするため、このサイトはホーム画面に追加して、そこから開いてください。'));
  const out = el('button', 'btn primary', 'バックアップを書き出す');
  out.type = 'button';
  out.addEventListener('click', async () => {
    if (await exportBackup()) say('書き出しました。');
  });
  view.append(out);
  view.append(filePicker('バックアップから戻す', '.json,application/json', async (text) => {
    try {
      const s = parseBackup(text);
      if (!confirm('今の記録をバックアップの内容で置き換えます。よろしいですか？')) return;
      state.settings = s.settings;
      state.swipes = s.swipes;
      state.genreFixes = s.genreFixes;
      state.closet = await Promise.all(s.closet.map(async (c) => ({ ...c, photo: await toBlob(c.photo) })));
      state.myPhotos = await Promise.all(s.myPhotos.map(async (p) => ({ ...p, photo: await toBlob(p.photo) })));
      for (const k of ['settings', 'swipes', 'genreFixes', 'closet', 'myPhotos']) await save(k);
      state.prefsVersion++;
      say('戻しました。');
    } catch (e) { say(e.message, true); }
  }));

  view.append(el('h2', null, '状態'));
  const when = state.status?.updatedAt ? new Date(state.status.updatedAt).toLocaleString('ja-JP') : '不明';
  const failed = Object.entries(state.status?.sources ?? {}).filter(([, v]) => !v.ok).map(([k]) => k);
  const info = el('ul', 'muted');
  for (const t of [
    `データの最終更新: ${when}`,
    `商品 ${state.items.length} 件・コーデ写真 ${state.looks.length} 件`,
    `スワイプ ${swipeList().length} 件・手持ち ${state.closet.length} 着`,
    failed.length ? `前回取れなかったお店: ${failed.join(', ')}（前の日のデータを表示中）` : '前回はすべてのお店から取れました',
  ]) info.append(el('li', null, t));
  view.append(info);
  navigator.storage?.persisted?.().then((p) => info.append(el('li', null, p ? '保存データは消されにくい設定になっています' : 'ホーム画面に追加して使うと、保存データが消えにくくなります')));

  view.append(el('h2', null, '全部消す'));
  const wipe = el('button', 'btn', 'この端末の記録を全部消す');
  wipe.type = 'button';
  wipe.addEventListener('click', async () => {
    if (!confirm('スワイプ・お気に入り・手持ち・設定を全部消します。元に戻せません。先にバックアップを書き出しましたか？')) return;
    if (!confirm('本当に消しますか？')) return;
    for (const k of ['settings', 'swipes', 'genreFixes', 'closet', 'myPhotos']) await store.del(k);
    location.reload();
  });
  view.append(wipe, msg);
}
