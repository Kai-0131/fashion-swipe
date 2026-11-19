import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../pipeline/run.mjs';

const NOW = '2026-11-19T11:00:00Z';
const product = (id) => ({
  id, title: `Wide Chino Pant ${id} Navy`, handle: `p${id}`, vendor: 'Stan Ray', product_type: 'Pants', tags: [], options: [],
  images: [{ src: `https://cdn.shopify.com/${id}.jpg` }], variants: [{ price: '100.00', compare_at_price: null }],
});

function harness({ files = {}, perShop = 2, fail = [] } = {}) {
  const fs = { ...files };
  const calls = [];
  const logs = [];
  const deps = {
    now: () => NOW,
    sleep: async () => {},
    log: (m) => logs.push(m),
    readFile: async (p) => { if (!(p in fs)) throw Object.assign(new Error('nf'), { code: 'ENOENT' }); return fs[p]; },
    writeFile: async (p, s) => { fs[p] = s; },
    fetchJson: async (url) => {
      calls.push(url);
      const host = new URL(url).host;
      if (fail.includes(host)) return { ok: false, status: 429, json: null, error: 'rate_limited' };
      const page = Number(new URL(url).searchParams.get('page'));
      const n = page === 1 ? perShop : 0;
      return { ok: true, status: 200, json: { products: Array.from({ length: n }, (_, i) => product(host.length * 1000 + i)) }, error: null };
    },
  };
  return { fs, calls, logs, deps };
}

test('run exits 0 and writes nothing when FETCH_ENABLED is not "true"', async () => {
  const h = harness();
  assert.equal(await run([], {}, h.deps), 0);
  assert.equal(h.calls.length, 0);
  assert.deepEqual(Object.keys(h.fs), []);
  assert.ok(h.logs.some((l) => /FETCH_ENABLED/.test(l)));
});

test('run --force ignores FETCH_ENABLED', async () => {
  const h = harness();
  assert.equal(await run(['--force', '--only=stanray'], {}, h.deps), 0);
  assert.ok(h.calls.length > 0);
});

test('run --dry-run writes nothing but logs counts per source', async () => {
  const h = harness();
  assert.equal(await run(['--dry-run', '--only=stanray,battenwear'], { FETCH_ENABLED: 'true' }, h.deps), 0);
  assert.deepEqual(Object.keys(h.fs), []);
  assert.ok(h.logs.some((l) => /stanray/.test(l) && /2/.test(l)));
});

test('run writes items, status and client tables', async () => {
  const h = harness();
  assert.equal(await run(['--only=stanray'], { FETCH_ENABLED: 'true' }, h.deps), 0);
  const snap = JSON.parse(h.fs['docs/data/items.json']);
  assert.equal(snap.items.length, 2);
  assert.equal(snap.items[0].kind, 'bottom');
  const status = JSON.parse(h.fs['docs/data/status.json']);
  assert.equal(status.updatedAt, NOW);
  assert.equal(status.sources.stanray.ok, true);
  for (const f of ['genres.json', 'colors.json', 'shops.json', 'people.json']) assert.ok(h.fs[`docs/data/${f}`], f);
});

test('run returns 1 and keeps old files on abort', async () => {
  const prevItems = Array.from({ length: 50 }, (_, i) => ({ id: `shopify:stanray:${i}`, shopId: 'stanray' }));
  const old = JSON.stringify({ updatedAt: 'x', items: prevItems, sources: {} });
  const h = harness({ files: { 'docs/data/items.json': old }, perShop: 3 });
  assert.equal(await run(['--only=stanray'], { FETCH_ENABLED: 'true' }, h.deps), 1);
  assert.equal(h.fs['docs/data/items.json'], old);
});

test('run keeps previous data for a failed shop', async () => {
  const prevItems = [{ id: 'shopify:battenwear:1', shopId: 'battenwear' }, { id: 'shopify:stanray:9', shopId: 'stanray' }];
  const h = harness({ files: { 'docs/data/items.json': JSON.stringify({ updatedAt: 'x', items: prevItems, sources: {} }) }, fail: ['www.battenwear.com'] });
  assert.equal(await run(['--only=stanray,battenwear'], { FETCH_ENABLED: 'true' }, h.deps), 0);
  const snap = JSON.parse(h.fs['docs/data/items.json']);
  assert.ok(snap.items.some((i) => i.id === 'shopify:battenwear:1'));
  assert.equal(snap.sources.battenwear.stale, true);
});

test('run --only limits shops', async () => {
  const h = harness();
  await run(['--dry-run', '--only=stanray'], { FETCH_ENABLED: 'true' }, h.deps);
  assert.ok(h.calls.every((u) => u.includes('stanray.com')));
});

test('run skips platform "link" shops', async () => {
  const h = harness();
  await run(['--dry-run', '--only=stanray,carharttwip'], { FETCH_ENABLED: 'true' }, h.deps);
  assert.ok(h.calls.every((u) => !u.includes('carhartt')));
});

function withPexels(h, photos, ok = true) {
  const base = h.deps.fetchJson;
  h.deps.fetchJson = async (url, opts) => {
    if (url.startsWith('https://api.pexels.com/')) {
      h.calls.push(url);
      return ok ? { ok: true, status: 200, json: { photos }, error: null } : { ok: false, status: 429, json: null, error: 'rate_limited' };
    }
    return base(url, opts);
  };
}
const pphoto = { id: 9, photographer: 'A', photographer_url: 'https://pexels.com/@a', url: 'https://pexels.com/photo/9', src: { portrait: 'https://images.pexels.com/9.jpg' } };

test('run writes looks when PEXELS_API_KEY is set', async () => {
  const h = harness();
  withPexels(h, [pphoto]);
  assert.equal(await run(['--only=stanray'], { FETCH_ENABLED: 'true', PEXELS_API_KEY: 'k' }, h.deps), 0);
  const looks = JSON.parse(h.fs['docs/data/looks.json']);
  assert.equal(looks.looks[0].id, 'pexels:9');
});

test('run keeps previous looks when pexels fails or has no key', async () => {
  const old = JSON.stringify({ updatedAt: 'x', looks: [{ id: 'pexels:1' }] });
  for (const env of [{ FETCH_ENABLED: 'true', PEXELS_API_KEY: 'k' }, { FETCH_ENABLED: 'true' }]) {
    const h = harness({ files: { 'docs/data/looks.json': old } });
    withPexels(h, [], false);
    assert.equal(await run(['--only=stanray'], env, h.deps), 0);
    assert.equal(h.fs['docs/data/looks.json'], old);
  }
});

test('serializeSnapshot writes one item per line sorted by id and parses back', async () => {
  const { serializeSnapshot } = await import('../pipeline/run.mjs');
  const snap = { updatedAt: 'u', sources: { a: { ok: true, count: 2 } }, items: [{ id: 'b' }, { id: 'a' }] };
  const text = serializeSnapshot(snap);
  assert.deepEqual(JSON.parse(text).items.map((i) => i.id), ['a', 'b']);
  assert.ok(text.split('\n').some((l) => l.startsWith('{"id":"a"}')));
});

test('serializeSnapshot writes short image addresses that parse back to the full ones', async () => {
  const { serializeSnapshot, parseSnapshot } = await import('../pipeline/run.mjs');
  const items = [{ id: 'a', shopId: 's', images: ['https://h/s/files/a.jpg'] }, { id: 'b', shopId: 's', images: ['https://h/s/files/b.jpg'] }];
  const text = serializeSnapshot({ updatedAt: 'u', sources: {}, items });
  assert.ok(!text.includes('https://h/s/files/a.jpg'));
  assert.deepEqual(JSON.parse(text).imageBase, { s: 'https://h/s/files/' });
  assert.deepEqual(parseSnapshot(text).items, items);
});
