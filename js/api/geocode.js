import { getJson, buildUrl } from './http.js';
import { CONFIG } from '../config.js';

/**
 * @typedef {{ lat: number, lon: number, name: string }} Place
 */

/** 브라우저 위치 권한으로 현재 좌표를 얻는다. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않습니다'));
      return;
    }
    // 브라우저 timeout 옵션은 권한 허용 이후부터 재므로, 팝업을 무시하거나
    // 팝업을 못 띄우는 환경(VS Code 내장 브라우저 등)에서는 영원히 대기한다.
    const timer = setTimeout(
      () => reject(new Error('위치 확인이 지연되고 있습니다')),
      CONFIG.geoTimeoutMs,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        clearTimeout(timer);
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 거부되었습니다'
              : '현재 위치를 가져올 수 없습니다',
          ),
        );
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** 좌표 → "김포시 운양동" 같은 지역명. 실패하면 좌표 문자열. */
export async function reverseGeocode(lat, lon) {
  try {
    const data = await getJson(
      buildUrl('https://api.bigdatacloud.net/data/reverse-geocode-client', {
        latitude: lat,
        longitude: lon,
        localityLanguage: 'ko',
      }),
    );
    const parts = [data.city, data.locality].filter(Boolean);
    const unique = [...new Set(parts)];
    if (unique.length) return unique.join(' ');
    if (data.principalSubdivision) return data.principalSubdivision;
  } catch {
    // 지역명은 부가 정보이므로 무시
  }
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

/**
 * 지역 이름 검색 (OpenStreetMap Nominatim — 한글 지명을 잘 찾는다).
 * 이용 정책상 사용자 입력 시에만 호출할 것 (자동완성 금지, 초당 1회 이하).
 * @param {string} query
 * @returns {Promise<Place[]>}
 */
export async function searchPlaces(query) {
  const data = await getJson(
    buildUrl('https://nominatim.openstreetmap.org/search', {
      q: query,
      format: 'jsonv2',
      limit: 6,
      'accept-language': 'ko',
      layer: 'address',
      featureType: 'settlement',
    }),
  );
  return data.map((r) => ({
    lat: Number(r.lat),
    lon: Number(r.lon),
    // "운양동, 김포시, 경기도, 10078, 대한민국" → "운양동, 김포시, 경기도"
    name: r.display_name
      .split(', ')
      .filter((part) => !/^\d+$/.test(part))
      .slice(0, 3)
      .join(', '),
  }));
}
