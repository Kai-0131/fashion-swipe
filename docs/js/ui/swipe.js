// Swipe screen: right = like, up = favourite, left = normal ("meh").
import { buildDeck } from '../deck.js';
import { genreScores, bucketOf } from '../learn.js';
import { state, save, swipeList, scoringSwipes, effectiveGenres } from '../app.js';
import { renderCard } from './card.js';
import { createImageGuard } from '../image-guard.js';

const imageGuard = createImageGuard(5);
import { openGenreFix } from './genre-fix.js';
import { setReason } from '../records.js';

const X_MIN = 100;
const Y_MIN = 80;
let deck = [];
let deckVersion = -1;
let lastId = null; // the shop item swiped just before; its reason can still be added

const REASONS = [['color', 1, '色が好き'], ['color', -1, '色が嫌'], ['shape', 1, '形が好き'], ['shape', -1, '形が嫌']];
function renderReasons(box) {
  box.replaceChildren();
  const rec = lastId && state.swipes[lastId];
  const shown = Boolean(rec && rec.kind === 'item');
  box.parentElement?.classList.toggle('has-reasons', shown);
  if (!shown) return;
  const row = document.createElement('div');
  row.className = 'chips';
  const p = document.createElement('span');
  p.className = 'muted';
  p.textContent = '前の服:';
  row.append(p);
  for (const [axis, value, label] of REASONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(rec.reasons?.[axis] === value));
    b.addEventListener('click', async () => {
      state.swipes = setReason(state.swipes, lastId, axis, value);
      await save('swipes');
      renderReasons(box);
    });
    row.append(b);
  }
  box.append(row);
}

function nextDeck() {
  deckVersion = state.prefsVersion;
  deck = buildDeck({
    items: state.items, looks: state.looks, swipes: scoringSwipes(), settings: state.settings,
    genres: state.genres, genreFixes: state.genreFixes,
  });
}

async function record(card, verdict) {
  const d = card.data;
  state.swipes[d.id] = {
    itemId: d.id, kind: card.kind, verdict, at: new Date().toISOString(),
    priceAtSave: card.kind === 'item' ? d.price : null, currency: card.kind === 'item' ? d.currency : null,
    snapshot: {
      title: d.title ?? null, image: d.image ?? d.images?.[0] ?? null, url: d.url ?? d.pageUrl ?? d.permalink ?? null,
      shopName: d.shopName ?? null, brand: d.brand ?? null, genres: effectiveGenres(d), colors: d.colors ?? [], kind: d.kind ?? null,
      credit: d.credit ?? null,
    },
  };
  await save('swipes');
}

export function renderSwipe(view) {
  if (deck.length === 0 || deckVersion !== state.prefsVersion || deck.some((c) => state.swipes[c.data.id])) nextDeck();
  const stack = document.createElement('div');
  stack.className = 'stack';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const reasons = document.createElement('div');
  reasons.className = 'reasons';
  view.append(stack, reasons, actions);
  renderReasons(reasons);

  const advance = () => { deck.shift(); if (deck.length === 0) nextDeck(); draw(); };
  const decide = async (verdict) => {
    const card = deck[0];
    if (!card) return;
    const elTop = stack.querySelector('.card:not(.back)');
    if (elTop) {
      const dx = verdict === 'like' ? 1 : verdict === 'meh' ? -1 : 0;
      elTop.style.transform = `translate(${dx * 140}%, ${verdict === 'fav' ? -120 : 0}%) rotate(${dx * 18}deg)`;
    }
    await record(card, verdict);
    lastId = card.data.id;
    renderReasons(reasons);
    setTimeout(advance, 180);
  };

  function draw() {
    stack.replaceChildren();
    actions.replaceChildren();
    if (imageGuard.tripped) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '写真を読み込めません。電波を確かめてから、もう一度開いてください。';
      const retry = document.createElement('button');
      retry.className = 'btn';
      retry.textContent = 'もう一度';
      retry.addEventListener('click', () => { imageGuard.reset(); draw(); });
      stack.append(p, retry);
      return;
    }
    if (deck.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '今日はここまで。明日また新しい服が入ります。';
      stack.append(p);
      return;
    }
    const opts = {
      onImageError: (card) => {
        imageGuard.fail();
        if (deck[0] === card) advance(); else deck = deck.filter((c) => c !== card);
      },
      onImageLoad: () => imageGuard.ok(),
      onFix: (card) => openGenreFix(card.data, () => {
        const RANK = ['like', 'near', 'maybe', 'challenge'];
        const scores = genreScores(scoringSwipes());
        const bs = effectiveGenres(card.data).map((g) => bucketOf(g, scores, state.settings, state.genres));
        card.bucket = bs.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] ?? card.bucket;
        deckVersion = state.prefsVersion; // keep this stack; the fix is applied to the card itself
        draw();
      }),
    };
    if (deck[1]) { const b = renderCard(deck[1], opts); b.classList.add('back'); stack.append(b); }
    const top = renderCard(deck[0], opts);
    stack.append(top);
    attachGestures(top, deck[0], decide);
    for (const [v, label, cls] of [['meh', '← 普通', 'a-meh'], ['fav', '↑ お気に入り', 'a-fav'], ['like', '好き →', 'a-like']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', () => decide(v));
      actions.append(b);
    }
  }
  draw();
}

function attachGestures(node, card, decide) {
  let sx = 0; let sy = 0; let t0 = 0; let active = false;
  const stamps = { like: node.querySelector('.stamp.like'), meh: node.querySelector('.stamp.meh'), fav: node.querySelector('.stamp.fav') };
  node.addEventListener('pointerdown', (e) => {
    active = true; sx = e.clientX; sy = e.clientY; t0 = Date.now();
    node.setPointerCapture(e.pointerId);
    node.classList.add('dragging');
  });
  node.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dx = e.clientX - sx; const dy = e.clientY - sy;
    node.style.transform = `translate(${dx}px, ${Math.min(dy, 40)}px) rotate(${dx / 18}deg)`;
    stamps.like.style.opacity = String(Math.max(0, Math.min(1, dx / X_MIN)));
    stamps.meh.style.opacity = String(Math.max(0, Math.min(1, -dx / X_MIN)));
    stamps.fav.style.opacity = String(Math.max(0, Math.min(1, -dy / Y_MIN)) * (Math.abs(dx) < X_MIN ? 1 : 0));
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    node.classList.remove('dragging');
    const dx = e.clientX - sx; const dy = e.clientY - sy;
    if (dx > X_MIN) return decide('like');
    if (dx < -X_MIN) return decide('meh');
    if (dy < -Y_MIN) return decide('fav');
    node.style.transform = '';
    for (const s of Object.values(stamps)) s.style.opacity = '0';
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - t0 < 400 && card.kind === 'item') location.hash = `#detail/${encodeURIComponent(card.data.id)}`;
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', (e) => { active = false; node.classList.remove('dragging'); node.style.transform = ''; });
}
