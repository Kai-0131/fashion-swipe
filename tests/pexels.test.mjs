import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPexelsLooks, MAX_QUERIES } from '../pipeline/sources/pexels.mjs';

const photo = (id) => ({
  id, photographer: `P${id}`, photographer_url: `https://www.pexels.com/@p${id}`, url: `https://www.pexels.com/photo/${id}/`,
  src: { portrait: `https://images.pexels.com/photos/${id}/p.jpeg?h=1200`, medium: 'm' },
});

function deps(pagesByQuery = {}, apiKey = 'KEY') {
  const calls = [];
  return {
    calls,
    deps: {
      apiKey,
      sleep: async () => {},
      fetchJson: async (url, opts) => {
        calls.push({ url, opts });
        const q = new URL(url).searchParams.get('query');
        return { ok: true, status: 200, json: { photos: pagesByQuery[q] ?? [] }, error: null };
      },
    },
  };
}

test('maps photo to look with credit', async () => {
  const d = deps({ 'street men': [photo(1)] });
  const r = await fetchPexelsLooks([{ genre: 'cityboy', query: 'street men' }], d.deps);
  assert.equal(r.ok, true);
  assert.deepEqual(r.looks[0], {
    id: 'pexels:1', source: 'pexels', image: 'https://images.pexels.com/photos/1/p.jpeg?h=1200', permalink: null,
    pageUrl: 'https://www.pexels.com/photo/1/', credit: { name: 'P1', url: 'https://www.pexels.com/@p1' }, genres: ['cityboy'],
  });
});

test('sends api key and portrait search', async () => {
  const d = deps({});
  await fetchPexelsLooks([{ genre: 'cityboy', query: 'a b' }], d.deps);
  assert.equal(d.calls[0].opts.headers.Authorization, 'KEY');
  const u = new URL(d.calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://api.pexels.com/v1/search');
  assert.equal(u.searchParams.get('orientation'), 'portrait');
  assert.equal(u.searchParams.get('per_page'), '30');
});

test('skips when apiKey missing', async () => {
  const d = deps({}, '');
  const r = await fetchPexelsLooks([{ genre: 'x', query: 'y' }], d.deps);
  assert.deepEqual(r, { ok: false, looks: null, error: 'no_key' });
  assert.equal(d.calls.length, 0);
});

test('stops at MAX_QUERIES (20)', async () => {
  assert.equal(MAX_QUERIES, 20);
  const d = deps({});
  const qs = Array.from({ length: 30 }, (_, i) => ({ genre: 'g', query: `q${i}` }));
  await fetchPexelsLooks(qs, d.deps);
  assert.equal(d.calls.length, 20);
});

test('dedupes same photo across queries and merges genres', async () => {
  const d = deps({ a: [photo(5)], b: [photo(5)] });
  const r = await fetchPexelsLooks([{ genre: 'cityboy', query: 'a' }, { genre: 'skate', query: 'b' }], d.deps);
  assert.equal(r.looks.length, 1);
  assert.deepEqual(r.looks[0].genres, ['cityboy', 'skate']);
});

test('fails whole source on an error response', async () => {
  const d = deps({});
  d.deps.fetchJson = async () => ({ ok: false, status: 429, json: null, error: 'rate_limited' });
  const r = await fetchPexelsLooks([{ genre: 'g', query: 'q' }], d.deps);
  assert.deepEqual(r, { ok: false, looks: null, error: 'rate_limited' });
});
