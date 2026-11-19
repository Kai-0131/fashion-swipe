// App shell: loads data and personal state, routes between tabs.
import * as store from './store.js';
import { hydrateItems, unpackImages } from './format.js';
import { photoLikes } from './learn.js';
import { renderBanner } from './ui/banner.js';
import { renderSwipe } from './ui/swipe.js';
import { renderLibrary } from './ui/library.js';
import { renderDetail } from './ui/detail.js';
import { renderDrops } from './ui/drops.js';
import { renderShops } from './ui/shops.js';
import { renderCloset } from './ui/closet.js';
import { renderSettings } from './ui/settings.js';

export const state = {
  items: [], itemsById: new Map(), looks: [], status: null,
  genres: { genres: [] }, pairs: {}, shops: [], people: [],
  settings: null, swipes: {}, closet: [], myPhotos: [], genreFixes: {}, lastBackupAt: null,
  loadError: null,
  prefsVersion: 0, // bump when settings / genre fixes change so the swipe stack is rebuilt
};

export const BUCKET_JA = { like: '好きなジャンル', near: '似たジャンル', maybe: '好きそう', challenge: '挑戦' };
export const KIND_JA = { top: '上', bottom: '下', outer: 'アウター', shoes: '靴', accessory: '小物', other: 'その他' };
export const genreName = (id) => state.genres.genres.find((g) => g.id === id)?.nameJa ?? id;
export const effectiveGenres = (x) => state.genreFixes[x.id] ?? x.genres ?? [];

export async function save(key) {
  try { await store.set(key, state[key]); } catch (e) { console.error('save failed', key, e); }
}

export const swipeList = () => Object.values(state.swipes);
// Swipes plus collected photos, for genre scoring only.
export const scoringSwipes = () => [...photoLikes(state.myPhotos), ...swipeList()];

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const opt = (p) => loadJson(p).catch(() => null);
  try {
    const [items, looks, status, genres, colors, shops, people] = await Promise.all([
      loadJson('data/items.json'), opt('data/looks.json'), opt('data/status.json'),
      loadJson('data/genres.json'), loadJson('data/colors.json'), loadJson('data/shops.json'), opt('data/people.json'),
    ]);
    state.shops = shops.shops;
    state.items = hydrateItems(unpackImages(items), state.shops);
    state.itemsById = new Map(state.items.map((i) => [i.id, i]));
    state.looks = looks?.looks ?? [];
    state.status = status ?? { updatedAt: items.updatedAt, sources: items.sources };
    state.genres = genres;
    state.pairs = colors.pairs;
    state.people = people?.people ?? [];
  } catch (e) {
    state.loadError = e.message;
  }
}

async function loadPersonal() {
  const get = (k, d) => store.get(k).then((v) => v ?? d).catch(() => d);
  state.settings = await get('settings', null);
  state.swipes = await get('swipes', {});
  state.closet = await get('closet', []);
  state.myPhotos = await get('myPhotos', []);
  state.genreFixes = await get('genreFixes', {});
  state.lastBackupAt = await get('lastBackupAt', null);
  // Ask the browser to keep this site's data (Safari can clear sites not opened for a while).
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
}

const ROUTES = { swipe: renderSwipe, library: renderLibrary, shops: renderShops, closet: renderCloset, drops: renderDrops, settings: renderSettings };

export function route() {
  const [name, arg] = (location.hash.slice(1) || 'swipe').split('/');
  const view = document.getElementById('view');
  for (const a of document.querySelectorAll('.tabs a')) {
    if (a.dataset.tab === name || (name === 'detail' && a.dataset.tab === 'library')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  renderBanner(document.getElementById('banner'));
  view.replaceChildren();
  if (state.loadError && name !== 'settings') {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `データを読み込めませんでした（${state.loadError}）。電波を確かめて開き直してください。`;
    view.append(p);
    return;
  }
  if (name === 'detail') renderDetail(view, decodeURIComponent(arg || ''));
  else (ROUTES[name] ?? renderSwipe)(view);
  window.scrollTo(0, 0);
}

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await Promise.all([loadData(), loadPersonal()]);
  store.persist();
  window.addEventListener('hashchange', route);
  route();
}

boot();
