/**
 * JSON GET 요청. 실패하면 사람이 읽을 수 있는 메시지로 에러를 던진다.
 * @param {string} url
 * @param {number} [timeoutMs]
 */
export async function getJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** @param {Record<string, string | number>} params */
export function buildUrl(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}
