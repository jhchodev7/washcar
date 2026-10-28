// API 응답 → 앱 내부 형식(DayWeather). 점수 엔진은 이 형식만 알면 된다.

/**
 * @typedef {{ time: string, hour: number, precipProb: number | null }} HourWeather
 * @typedef {{
 *   date: string,
 *   weatherCode: number | null,
 *   precipProb: number | null,
 *   precipSum: number,
 *   snowfall: number,
 *   tMin: number | null,
 *   tMax: number | null,
 *   windMax: number | null,
 *   pm10Max: number | null,
 *   dustMax: number | null,
 *   hourly: HourWeather[],
 * }} DayWeather
 */

/**
 * @param {any} forecast Open-Meteo forecast 응답
 * @param {any | null} air Open-Meteo air-quality 응답
 * @param {number} [nowMs] 테스트용 현재 시각
 * @returns {{ days: DayWeather[], nowLocal: string }}
 */
export function normalize(forecast, air, nowMs = Date.now()) {
  const d = forecast.daily;
  const hourlyByDate = groupHourly(forecast.hourly);
  const airByDate = dailyAirMax(air);

  const days = d.time.map((date, i) => ({
    date,
    weatherCode: d.weather_code?.[i] ?? null,
    precipProb: d.precipitation_probability_max?.[i] ?? null,
    precipSum: d.precipitation_sum?.[i] ?? 0,
    snowfall: d.snowfall_sum?.[i] ?? 0,
    tMin: d.temperature_2m_min?.[i] ?? null,
    tMax: d.temperature_2m_max?.[i] ?? null,
    windMax: d.wind_speed_10m_max?.[i] ?? null,
    pm10Max: airByDate[date]?.pm10 ?? null,
    dustMax: airByDate[date]?.dust ?? null,
    hourly: hourlyByDate[date] ?? [],
  }));

  return { days, nowLocal: localIsoMinutes(nowMs, forecast.utc_offset_seconds ?? 0) };
}

/** 예보 지역 기준 현재 시각 "YYYY-MM-DDTHH:MM" (API의 시간 문자열과 같은 형식) */
export function localIsoMinutes(nowMs, utcOffsetSeconds) {
  return new Date(nowMs + utcOffsetSeconds * 1000).toISOString().slice(0, 16);
}

function groupHourly(hourly) {
  /** @type {Record<string, HourWeather[]>} */
  const out = {};
  if (!hourly?.time) return out;
  hourly.time.forEach((time, i) => {
    const date = time.slice(0, 10);
    (out[date] ??= []).push({
      time,
      hour: Number(time.slice(11, 13)),
      precipProb: hourly.precipitation_probability?.[i] ?? null,
    });
  });
  return out;
}

function dailyAirMax(air) {
  /** @type {Record<string, { pm10: number | null, dust: number | null }>} */
  const out = {};
  if (!air?.hourly?.time) return out;
  air.hourly.time.forEach((time, i) => {
    const date = time.slice(0, 10);
    const entry = (out[date] ??= { pm10: null, dust: null });
    entry.pm10 = maxOrNull(entry.pm10, air.hourly.pm10?.[i]);
    entry.dust = maxOrNull(entry.dust, air.hourly.dust?.[i]);
  });
  return out;
}

function maxOrNull(a, b) {
  if (b == null) return a;
  return a == null ? b : Math.max(a, b);
}
