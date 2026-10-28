// 세차 추천 점수 엔진. DOM/네트워크에 의존하지 않는 순수 함수만 둔다.
import { CONFIG } from '../config.js';

/**
 * @typedef {import('./normalize.js').DayWeather} DayWeather
 * @typedef {{ icon: string, text: string }} Reason
 * @typedef {{ startHour: number, endHour: number, avgProb: number }} WashWindow
 * @typedef {{
 *   date: string,
 *   offset: number,
 *   score: number,
 *   expectedCleanDays: number,
 *   survival: { date: string, prob: number }[],
 *   washFactor: number,
 *   washReasons: Reason[],
 *   window: WashWindow | null,
 *   nextDayDirt: number,
 *   spoiler: { date: string, prob: number, reasons: Reason[] } | null,
 * }} DayScore
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * 하루 동안 차가 다시 더러워질 확률.
 * @param {DayWeather} day
 * @returns {{ prob: number, reasons: Reason[] }}
 */
export function dirtProbability(day, cfg = CONFIG.dirt) {
  /** @type {Reason[]} */
  const reasons = [];

  let rain = day.precipProb == null ? cfg.unknownProb : day.precipProb / 100;
  const isSnow = day.snowfall >= cfg.snowMinCm;
  if (day.precipSum < cfg.drizzleMm && !isSnow) rain *= cfg.drizzleFactor;
  if (isSnow) {
    rain = clamp01(rain * cfg.snowWeight);
    if (rain >= 0.3) reasons.push({ icon: '❄️', text: `눈 ${pct(rain)}` });
  } else if (rain >= 0.3) {
    reasons.push({ icon: '🌧️', text: `비 ${pct(rain)}` });
  }

  let air = 0;
  if (day.dustMax != null && day.dustMax >= cfg.dustBad) {
    air = Math.max(air, cfg.dustPenalty);
    reasons.push({ icon: '🌫️', text: '황사' });
  }
  if (day.pm10Max != null && day.pm10Max >= cfg.pm10Bad) {
    air = Math.max(air, cfg.pm10Penalty);
    reasons.push({ icon: '😷', text: '미세먼지 나쁨' });
  }

  return { prob: clamp01(Math.max(rain, air)), reasons };
}

/**
 * 세차 당일 조건 배수(0~1)와 추천 시간대.
 * @param {DayWeather} day
 * @param {string} nowLocal "YYYY-MM-DDTHH:MM" — 이미 지난 시간은 제외
 * @returns {{ factor: number, reasons: Reason[], window: WashWindow | null }}
 */
export function washDayFactor(day, nowLocal, cfg = CONFIG) {
  const w = cfg.washDay;
  const [startH, endH] = cfg.daytimeHours;
  /** @type {Reason[]} */
  const reasons = [];

  const hasHourly = day.hourly.length > 0;
  const usable = day.hourly.filter((h) => h.hour >= startH && h.hour < endH && h.time > nowLocal);
  if (hasHourly && usable.length === 0) {
    return { factor: 0, reasons: [{ icon: '🌙', text: '세차할 시간이 지났어요' }], window: null };
  }

  let factor = 1;
  const probs = usable.map((h) => h.precipProb).filter((p) => p != null);
  const daytimeMax = probs.length ? Math.max(...probs) : day.precipProb ?? 0;
  if (daytimeMax >= w.rainProb) {
    factor *= w.rainFactor;
    reasons.push({ icon: '☔', text: `세차 시간대 비 ${daytimeMax}%` });
  }
  if (day.tMin != null && day.tMin <= w.freezeTemp) {
    factor *= w.freezeFactor;
    reasons.push({ icon: '🥶', text: `결빙 위험 (최저 ${Math.round(day.tMin)}°)` });
  }
  if (day.windMax != null && day.windMax >= w.windMs) {
    factor *= w.windFactor;
    reasons.push({ icon: '💨', text: `강풍 ${Math.round(day.windMax)}m/s` });
  }
  if (day.tMax != null && day.tMax >= w.hotTemp) {
    factor *= w.hotFactor;
    reasons.push({ icon: '🥵', text: '물자국 주의 (폭염)' });
  }

  return { factor, reasons, window: bestWindow(usable, cfg.washWindowHours) };
}

/**
 * 연속된 시간 중 평균 강수확률이 가장 낮은 구간. 동률이면 이른 시간.
 * @param {import('./normalize.js').HourWeather[]} hours
 * @returns {WashWindow | null}
 */
export function bestWindow(hours, size) {
  if (hours.length === 0) return null;
  const len = Math.min(size, hours.length);
  let best = null;
  for (let i = 0; i + len <= hours.length; i++) {
    const slice = hours.slice(i, i + len);
    const avg = slice.reduce((s, h) => s + (h.precipProb ?? 0), 0) / len;
    if (!best || avg < best.avgProb) {
      best = { startHour: slice[0].hour, endHour: slice[len - 1].hour + 1, avgProb: avg };
    }
  }
  return best;
}

/**
 * 깨끗함이 유지될 날 수의 기대값: Σ_k Π_{j≤k} (1 − d_j)
 * @param {number[]} dirtProbs 세차 다음 날부터의 오염 확률
 */
export function expectedCleanDays(dirtProbs) {
  let alive = 1;
  const survival = dirtProbs.map((p) => (alive *= 1 - p));
  return { expected: survival.reduce((a, b) => a + b, 0), survival };
}

/**
 * 오늘부터 evalDays일까지 각 날짜에 세차했을 때의 점수.
 * @param {DayWeather[]} days
 * @param {string} nowLocal
 * @returns {DayScore[]}
 */
export function scoreDays(days, nowLocal, cfg = CONFIG) {
  const dirt = days.map((d) => dirtProbability(d, cfg.dirt));
  /** @type {DayScore[]} */
  const results = [];

  for (let i = 0; i < Math.min(cfg.evalDays, days.length); i++) {
    const after = dirt.slice(i + 1, i + 1 + cfg.lookaheadDays);
    if (after.length === 0) break;

    const { expected, survival } = expectedCleanDays(after.map((x) => x.prob));
    const wash = washDayFactor(days[i], nowLocal, cfg);
    const confidence = Math.max(0, 1 - cfg.confidenceDecayPerDay * i);
    const score = Math.round(100 * wash.factor * (expected / after.length) * confidence);

    const spoilerIdx = after.findIndex((x) => x.prob >= 0.5);
    results.push({
      date: days[i].date,
      offset: i,
      score,
      expectedCleanDays: expected,
      survival: survival.map((prob, k) => ({ date: days[i + 1 + k].date, prob })),
      washFactor: wash.factor,
      washReasons: wash.reasons,
      window: wash.window,
      nextDayDirt: after[0].prob,
      spoiler:
        spoilerIdx < 0
          ? null
          : {
              date: days[i + 1 + spoilerIdx].date,
              prob: after[spoilerIdx].prob,
              reasons: after[spoilerIdx].reasons,
            },
    });
  }
  return results;
}

/**
 * 최고 점수 날짜 (동률이면 더 이른 날).
 * @param {DayScore[]} results
 */
export function pickBest(results, cfg = CONFIG) {
  if (results.length === 0) return { best: null, giveUp: true };
  const best = results.reduce((a, b) => (b.score > a.score ? b : a));
  return { best, giveUp: best.score < cfg.giveUpScore };
}

function pct(p) {
  return `${Math.round(p * 100)}%`;
}
