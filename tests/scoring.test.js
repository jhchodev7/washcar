// 실행: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { normalize, localIsoMinutes } from '../js/core/normalize.js';
import {
  dirtProbability,
  washDayFactor,
  bestWindow,
  expectedCleanDays,
  scoreDays,
  pickBest,
} from '../js/core/scoring.js';

/** 테스트용 하루 날씨. hourly는 0~23시, 모두 같은 강수확률 */
function day(date, overrides = {}) {
  const hourProb = overrides.hourProb ?? overrides.precipProb ?? 0;
  return {
    date,
    weatherCode: 0,
    precipProb: 0,
    precipSum: 0,
    snowfall: 0,
    tMin: 10,
    tMax: 20,
    windMax: 3,
    pm10Max: 30,
    dustMax: 0,
    hourly: Array.from({ length: 24 }, (_, h) => ({
      time: `${date}T${String(h).padStart(2, '0')}:00`,
      hour: h,
      precipProb: hourProb,
    })),
    ...overrides,
  };
}

function week(probs) {
  return probs.map((p, i) =>
    day(`2026-11-${String(i + 1).padStart(2, '0')}`, { precipProb: p, precipSum: p > 0 ? 5 : 0 }),
  );
}

const MORNING = '2026-11-01T06:00';

test('맑은 날은 오염 확률 0', () => {
  assert.equal(dirtProbability(day('2026-11-01')).prob, 0);
});

test('이슬비(강수량 1mm 미만)는 확률을 절반으로', () => {
  const r = dirtProbability(day('2026-11-01', { precipProb: 60, precipSum: 0.3 }));
  assert.equal(r.prob, 0.3);
});

test('눈은 가중치를 받고 1을 넘지 않는다', () => {
  const r = dirtProbability(day('2026-11-01', { precipProb: 90, precipSum: 5, snowfall: 3 }));
  assert.equal(r.prob, 1);
  assert.equal(r.reasons[0].icon, '❄️');
});

test('적설이 미미하면 눈이 아니라 비로 취급', () => {
  const r = dirtProbability(day('2026-11-01', { precipProb: 90, precipSum: 5, snowfall: 0.1 }));
  assert.equal(r.prob, 0.9);
  assert.equal(r.reasons[0].icon, '🌧️');
});

test('황사는 비가 없어도 오염', () => {
  const r = dirtProbability(day('2026-11-01', { dustMax: 200 }));
  assert.equal(r.prob, CONFIG.dirt.dustPenalty);
});

test('기대 유지일: 모두 맑으면 N일, 다음날 확실히 비면 0일', () => {
  assert.equal(expectedCleanDays([0, 0, 0]).expected, 3);
  assert.equal(expectedCleanDays([1, 0, 0]).expected, 0);
  assert.equal(expectedCleanDays([0.5, 0.5]).expected, 0.5 + 0.25);
});

test('국룰: 다음날 비 오는 날은 점수가 낮다', () => {
  // 11/1 세차 → 11/2 비. 11/2는 비 와서 세차 불가. 11/3 세차 → 이후 맑음
  const days = week([0, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const results = scoreDays(days, MORNING);
  assert.equal(results[0].nextDayDirt, 0.9);
  assert.ok(results[0].score < 30);
  const { best, giveUp } = pickBest(results);
  assert.equal(best.date, '2026-11-03');
  assert.equal(giveUp, false);
});

test('비 오는 당일 세차는 크게 감점', () => {
  const days = week([0, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [, rainy, after] = scoreDays(days, MORNING);
  assert.ok(rainy.score < after.score);
  assert.equal(rainy.washFactor, CONFIG.washDay.rainFactor);
});

test('결빙 날씨는 감점', () => {
  const r = washDayFactor(day('2026-11-01', { tMin: -5 }), MORNING);
  assert.equal(r.factor, CONFIG.washDay.freezeFactor);
});

test('오늘 세차 시간대가 지나면 점수 0', () => {
  const days = week(Array(12).fill(0));
  const results = scoreDays(days, '2026-11-01T20:00');
  assert.equal(results[0].score, 0);
  assert.equal(results[0].window, null);
});

test('먼 날일수록 신뢰도 감소 → 모두 맑으면 오늘이 최고', () => {
  const results = scoreDays(week(Array(12).fill(0)), MORNING);
  assert.equal(results.length, CONFIG.evalDays);
  assert.equal(results[0].score, 100);
  assert.ok(results[6].score < results[0].score);
  assert.equal(pickBest(results).best.offset, 0);
});

test('모든 날이 나쁘면 giveUp', () => {
  const { giveUp } = pickBest(scoreDays(week(Array(12).fill(90)), MORNING));
  assert.equal(giveUp, true);
});

test('추천 시간대는 강수확률이 가장 낮은 연속 구간', () => {
  const hours = [9, 10, 11, 12, 13, 14].map((h, i) => ({
    time: `2026-11-01T${h}:00`,
    hour: h,
    precipProb: [50, 40, 10, 0, 0, 60][i],
  }));
  assert.deepEqual(bestWindow(hours, 3), { startHour: 11, endHour: 14, avgProb: 10 / 3 });
});

test('normalize: Open-Meteo 응답을 날짜별로 묶고 대기질을 합친다', () => {
  const forecast = {
    utc_offset_seconds: 9 * 3600,
    daily: {
      time: ['2026-11-01', '2026-11-02'],
      weather_code: [0, 61],
      precipitation_probability_max: [10, 80],
      precipitation_sum: [0, 12],
      snowfall_sum: [0, 0],
      temperature_2m_min: [5, 7],
      temperature_2m_max: [15, 12],
      wind_speed_10m_max: [3, 6],
    },
    hourly: {
      time: ['2026-11-01T09:00', '2026-11-01T10:00', '2026-11-02T09:00'],
      precipitation_probability: [0, 10, 80],
    },
  };
  const air = {
    hourly: { time: ['2026-11-01T00:00', '2026-11-01T12:00'], pm10: [40, 160], dust: [null, 5] },
  };
  const { days } = normalize(forecast, air, Date.UTC(2026, 10, 1, 0, 0));
  assert.equal(days.length, 2);
  assert.equal(days[0].hourly.length, 2);
  assert.equal(days[0].pm10Max, 160);
  assert.equal(days[0].dustMax, 5);
  assert.equal(days[1].pm10Max, null);
  assert.equal(days[1].precipProb, 80);
});

test('localIsoMinutes는 예보 지역 시간대를 반영', () => {
  assert.equal(localIsoMinutes(Date.UTC(2026, 10, 1, 15, 30), 9 * 3600), '2026-11-02T00:30');
});
