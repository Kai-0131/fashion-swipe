// Owned clothes: take a photo, pick kind and colors. Photos stay on the phone.
import { state, save, KIND_JA } from '../app.js';
import { COLOR_LABELS } from '../colors.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const MAX_SIDE = 800;

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}

function chooser(entries, multi, chosen) {
  const row = el('div', 'chips');
  for (const [value, label] of entries) {
    const b = el('button', 'chip', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(chosen.has(value)));
    b.addEventListener('click', () => {
      if (!multi) { chosen.clear(); for (const x of row.children) x.setAttribute('aria-pressed', 'false'); }
      if (chosen.has(value)) chosen.delete(value); else chosen.add(value);
      b.setAttribute('aria-pressed', String(chosen.has(value)));
    });
    row.append(b);
  }
  return row;
}

export function renderCloset(view) {
  view.append(el('h2', null, '手持ちの服を登録'));
  const kind = new Set();
  const colors = new Set();
  const file = el('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.setAttribute('capture', 'environment');
  const msg = el('p', 'muted');
  const add = el('button', 'btn primary', '登録する');
  add.type = 'button';
  add.addEventListener('click', async () => {
    const f = file.files?.[0];
    if (!f) { msg.textContent = '写真を選んでください。'; return; }
    if (kind.size === 0) { msg.textContent = '種類を選んでください。'; return; }
    add.disabled = true;
    try {
      const photo = await shrink(f);
      state.closet.push({ id: `c${Date.now()}`, kind: [...kind][0], colors: [...colors], photo, addedAt: new Date().toISOString() });
      await save('closet');
      view.replaceChildren();
      renderCloset(view);
    } catch (e) {
      msg.textContent = `登録できませんでした（${e.message}）。`;
      add.disabled = false;
    }
  });
  const f1 = el('label', 'field'); f1.append('写真', file);
  const f2 = el('div', 'field'); f2.append(el('span', null, '種類'), chooser(Object.entries(KIND_JA).filter(([k]) => k !== 'other'), false, kind));
  const f3 = el('div', 'field'); f3.append(el('span', null, '色（複数可）'), chooser(Object.entries(COLOR_LABELS).map(([k, v]) => [k, v.ja]), true, colors));
  view.append(f1, f2, f3, add, msg);

  view.append(el('h2', null, `登録済み（${state.closet.length}）`));
  const grid = el('div', 'grid');
  for (const c of state.closet) {
    const cellEl = el('div', 'cell');
    const i = el('img');
    i.src = c.photo instanceof Blob ? URL.createObjectURL(c.photo) : c.photo;
    i.alt = KIND_JA[c.kind] ?? '';
    const del = el('button', 'mark', `${KIND_JA[c.kind] ?? ''} ✕`);
    del.type = 'button';
    del.style.border = 'none';
    del.addEventListener('click', async () => {
      if (!confirm('この服を消しますか？')) return;
      state.closet = state.closet.filter((x) => x.id !== c.id);
      await save('closet');
      view.replaceChildren();
      renderCloset(view);
    });
    cellEl.append(i, del);
    grid.append(cellEl);
  }
  view.append(grid);
}
