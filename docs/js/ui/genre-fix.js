// Sheet to correct a card's genres (saved on the phone, used from then on).
import { state, save, genreName, effectiveGenres } from '../app.js';

export function openGenreFix(data, onDone) {
  const chosen = new Set(effectiveGenres(data));
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const box = document.createElement('div');
  const h = document.createElement('h2');
  h.textContent = 'ジャンルを選び直す（最大3つ）';
  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const g of state.genres.genres) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = genreName(g.id);
    b.setAttribute('aria-pressed', String(chosen.has(g.id)));
    b.addEventListener('click', () => {
      if (chosen.has(g.id)) chosen.delete(g.id);
      else if (chosen.size < 3) chosen.add(g.id);
      b.setAttribute('aria-pressed', String(chosen.has(g.id)));
    });
    chips.append(b);
  }
  const row = document.createElement('div');
  row.className = 'row';
  row.style.marginTop = '14px';
  const ok = document.createElement('button');
  ok.className = 'btn primary';
  ok.textContent = '保存';
  ok.addEventListener('click', async () => {
    state.genreFixes[data.id] = [...chosen];
    await save('genreFixes');
    state.prefsVersion++;
    sheet.remove();
    onDone?.();
  });
  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.textContent = 'やめる';
  cancel.addEventListener('click', () => sheet.remove());
  row.append(ok, cancel);
  box.append(h, chips, row);
  sheet.append(box);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
  document.body.append(sheet);
}
