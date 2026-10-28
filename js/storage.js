// localStorage 래퍼. 사생활 보호 모드 등에서 실패해도 앱이 깨지지 않게 한다.
const PREFIX = 'washcar:';

export function load(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시
  }
}

/** { savedAt, value } 형태로 저장 — 캐시 만료 판단용 */
export function saveWithTime(key, value) {
  save(key, { savedAt: Date.now(), value });
}
