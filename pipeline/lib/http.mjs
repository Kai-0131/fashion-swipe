// Safe JSON fetch: never throws, always returns { ok, status, json, error }.
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, opts = {}) {
  const { headers = {}, timeoutMs = 20000, fetchImpl = fetch } = opts;
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const error = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : `network: ${e?.message ?? e}`;
    return { ok: false, status: 0, json: null, error };
  }
  if (res.status === 429) return { ok: false, status: 429, json: null, error: 'rate_limited' };
  if (!res.ok) return { ok: false, status: res.status, json: null, error: `http_${res.status}` };
  let text;
  try { text = await res.text(); } catch (e) {
    return { ok: false, status: res.status, json: null, error: e?.name === 'TimeoutError' ? 'timeout' : 'read_failed' };
  }
  try {
    return { ok: true, status: res.status, json: JSON.parse(text), error: null };
  } catch {
    return { ok: false, status: res.status, json: null, error: 'not_json' };
  }
}
