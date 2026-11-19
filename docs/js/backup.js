// Backup file out: the share sheet on iPhone (pick "ファイルに保存" → iCloud Drive), a download elsewhere.
import { state, save } from './app.js';
import { makeBackup } from './pack.js';

export async function exportBackup() {
  const json = await makeBackup(state);
  const name = `fashion-swipe-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e?.name === 'AbortError') return false; throw e; }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
  }
  state.lastBackupAt = new Date().toISOString();
  await save('lastBackupAt');
  return true;
}
