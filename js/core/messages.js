// 화면에 보여줄 문구와 날짜/날씨 표기. 문구를 바꾸려면 이 파일만 고치면 된다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-10-28" → "수" */
export function weekday(date) {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** "2026-10-28" → "10/28" */
export function shortDate(date) {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** offset(0=오늘)에 맞는 이름 */
export function dayLabel(date, offset) {
  if (offset === 0) return '오늘';
  if (offset === 1) return '내일';
  if (offset === 2) return '모레';
  return `${weekday(date)}요일`;
}

/** WMO weather code → 이모지/설명 */
export function weatherInfo(code) {
  if (code == null) return { emoji: '❔', label: '정보 없음' };
  if (code === 0) return { emoji: '☀️', label: '맑음' };
  if (code <= 2) return { emoji: '🌤️', label: '구름 조금' };
  if (code === 3) return { emoji: '☁️', label: '흐림' };
  if (code <= 48) return { emoji: '🌫️', label: '안개' };
  if (code <= 57) return { emoji: '🌦️', label: '이슬비' };
  if (code <= 67) return { emoji: '🌧️', label: '비' };
  if (code <= 77) return { emoji: '🌨️', label: '눈' };
  if (code <= 82) return { emoji: '🌧️', label: '소나기' };
  if (code <= 86) return { emoji: '🌨️', label: '소낙눈' };
  return { emoji: '⛈️', label: '뇌우' };
}

export function scoreGrade(score) {
  if (score >= 80) return { key: 'great', label: '최고' };
  if (score >= 60) return { key: 'good', label: '좋음' };
  if (score >= 30) return { key: 'meh', label: '애매' };
  return { key: 'bad', label: '비추' };
}

export function heroMessage(best, giveUp) {
  if (!best) return '예보 데이터가 부족해요';
  if (giveUp) return '이번 주는 참으세요. 차라리 코팅제를 바르세요 🧴';
  if (best.score >= 80) return '이번엔 국룰을 깰 수 있습니다 💪';
  if (best.score >= 60) return '이 정도면 해볼 만합니다';
  return '그나마 이 날이 제일 덜 억울합니다';
}

/** "오늘 세차하면?" 카드 문구. prob = 내일 더러워질 확률 */
export function gukrulMessage(prob) {
  if (prob >= 0.7) return '국룰 발동 확정. 세차하는 순간 하늘이 압니다 🌧️';
  if (prob >= 0.4) return '국룰 발동 가능성 있음. 도박입니다 🎲';
  if (prob >= 0.2) return '국룰이 잠잠한 편이에요';
  return '국룰도 쉬는 날. 내일은 맑아요 ☀️';
}

export function formatWindow(w) {
  if (!w) return '';
  return `${w.startHour}~${w.endHour}시`;
}
