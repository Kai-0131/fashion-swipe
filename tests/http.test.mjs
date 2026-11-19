import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, UA } from '../pipeline/lib/http.mjs';

const res = (body, status = 200) => async () => new Response(body, { status });

test('fetchJson returns ok with parsed json', async () => {
  const r = await fetchJson('https://x', { fetchImpl: res('{"products":[]}') });
  assert.equal(r.ok, true);
  assert.deepEqual(r.json, { products: [] });
  assert.equal(r.error, null);
});

test('fetchJson marks html as not_json', async () => {
  const r = await fetchJson('https://x', { fetchImpl: res('<!DOCTYPE html><html></html>') });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_json');
});

test('fetchJson marks 429 as rate_limited', async () => {
  const r = await fetchJson('https://x', { fetchImpl: res('{"errors":[]}', 429) });
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  assert.equal(r.error, 'rate_limited');
});

test('fetchJson marks other http errors', async () => {
  const r = await fetchJson('https://x', { fetchImpl: res('{}', 404) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'http_404');
});

test('fetchJson never throws on network error', async () => {
  const r = await fetchJson('https://x', { fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  assert.equal(r.ok, false);
  assert.match(r.error, /fetch failed|network/);
});

test('fetchJson reports timeout', async () => {
  const slow = (url, opts) => new Promise((_, rej) => {
    opts.signal.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'TimeoutError' })));
  });
  const r = await fetchJson('https://x', { fetchImpl: slow, timeoutMs: 20 });
  assert.equal(r.error, 'timeout');
});

test('fetchJson sends the UA header', async () => {
  let seen;
  await fetchJson('https://x', { fetchImpl: async (u, o) => { seen = o.headers; return new Response('{}'); } });
  assert.equal(seen['User-Agent'], UA);
  assert.match(UA, /Chrome\/130/);
});
