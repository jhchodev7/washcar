// Open-Meteo 날씨/대기질 API. 키가 필요 없고 CORS를 허용한다.
// 다른 날씨 제공자로 바꾸려면 같은 형태의 { forecast, air }를 반환하는 모듈을 만들면 된다.
import { getJson, buildUrl } from './http.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/**
 * @param {number} lat
 * @param {number} lon
 * @param {number} days
 */
export function fetchForecast(lat, lon, days) {
  return getJson(
    buildUrl(FORECAST_URL, {
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
      forecast_days: days,
      wind_speed_unit: 'ms',
      daily: [
        'weather_code',
        'precipitation_probability_max',
        'precipitation_sum',
        'snowfall_sum',
        'temperature_2m_min',
        'temperature_2m_max',
        'wind_speed_10m_max',
      ].join(','),
      hourly: 'precipitation_probability',
    }),
  );
}

/** 대기질 예보는 최대 5~7일만 제공된다. 실패해도 앱은 동작해야 하므로 null을 반환. */
export async function fetchAirQuality(lat, lon) {
  try {
    return await getJson(
      buildUrl(AIR_URL, {
        latitude: lat,
        longitude: lon,
        timezone: 'auto',
        forecast_days: 5,
        hourly: 'pm10,dust',
      }),
    );
  } catch {
    return null;
  }
}
