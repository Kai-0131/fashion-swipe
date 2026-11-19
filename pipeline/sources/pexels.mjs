// Outfit photos from Pexels (free, photographer credit required).
export const MAX_QUERIES = 20;
const GAP_MS = 1500;

export async function fetchPexelsLooks(queries, { fetchJson, sleep, apiKey }) {
  if (!apiKey) return { ok: false, looks: null, error: 'no_key' };
  const byId = new Map();
  for (const [i, { genre, query }] of queries.slice(0, MAX_QUERIES).entries()) {
    if (i > 0) await sleep(GAP_MS);
    const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: '30', orientation: 'portrait' })}`;
    const r = await fetchJson(url, { headers: { Authorization: apiKey } });
    if (!r.ok) return { ok: false, looks: null, error: r.error };
    for (const p of r.json?.photos ?? []) {
      const id = `pexels:${p.id}`;
      const prev = byId.get(id);
      if (prev) { if (!prev.genres.includes(genre)) prev.genres.push(genre); continue; }
      if (!p.src?.portrait) continue;
      byId.set(id, {
        id, source: 'pexels', image: p.src.portrait, permalink: null, pageUrl: p.url,
        credit: { name: p.photographer, url: p.photographer_url }, genres: [genre],
      });
    }
  }
  return { ok: true, looks: [...byId.values()], error: null };
}
