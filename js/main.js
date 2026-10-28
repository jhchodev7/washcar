// 진입점: 위치 → 날씨 → 점수 → 화면 흐름과 이벤트 연결만 담당한다.
import { CONFIG, FORECAST_DAYS } from './config.js';
import { fetchForecast, fetchAirQuality } from './api/openMeteo.js';
import { getCurrentPosition, reverseGeocode, searchPlaces } from './api/geocode.js';
import { normalize } from './core/normalize.js';
import { scoreDays, pickBest } from './core/scoring.js';
import * as storage from './storage.js';
import * as ui from './ui/render.js';

const PLACE_KEY = 'place';

/** 현재 화면 상태 */
let view = null;
/** @type {import('./api/geocode.js').Place[]} */
let searchResults = [];

async function start() {
  bindEvents();

  // ?lat=37.6&lon=126.7&name=김포 — 특정 지역을 북마크/공유할 때
  const params = new URLSearchParams(location.search);
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (params.has('lat') && params.has('lon') && Number.isFinite(lat) && Number.isFinite(lon)) {
    await showPlace({ lat, lon, name: params.get('name') ?? (await reverseGeocode(lat, lon)) });
    return;
  }

  try {
    await useCurrentLocation();
  } catch (err) {
    const saved = storage.load(PLACE_KEY);
    if (saved) {
      ui.renderStatus(`${err.message}. 마지막 위치로 보여드려요.`);
      await showPlace(saved, { keepStatus: true });
    } else {
      ui.renderPlace('위치 없음');
      ui.renderStatus(`${err.message}. 위치를 직접 선택해 주세요.`, true);
      openPicker();
    }
  }
}

async function useCurrentLocation() {
  ui.renderStatus('현재 위치를 확인하고 있어요…');
  const { lat, lon } = await getCurrentPosition();
  const name = await reverseGeocode(lat, lon);
  await showPlace({ lat, lon, name });
}

/** @param {import('./api/geocode.js').Place} place */
async function showPlace(place, { keepStatus = false } = {}) {
  storage.save(PLACE_KEY, place);
  ui.renderPlace(place.name);
  if (!keepStatus) ui.renderStatus('날씨를 불러오고 있어요…');

  try {
    const { forecast, air, savedAt } = await loadWeather(place);
    const { days, nowLocal } = normalize(forecast, air);
    const results = scoreDays(days, nowLocal);
    const { best, giveUp } = pickBest(results);
    view = { days, results, best, giveUp, selectedDate: best?.date ?? results[0]?.date };
    ui.renderResults(view);
    ui.renderUpdated(savedAt);
    if (!keepStatus) ui.renderStatus(null);
  } catch (err) {
    view = null;
    ui.clearResults();
    ui.renderStatus(`날씨를 불러오지 못했어요: ${err.message}`, true);
  }
}

/** 1시간 캐시. 좌표는 소수점 2자리(약 1km)로 묶는다. */
async function loadWeather({ lat, lon }) {
  const key = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = storage.load(key);
  if (cached && Date.now() - cached.savedAt < CONFIG.cacheTtlMs) {
    return { ...cached.value, savedAt: cached.savedAt };
  }
  const [forecast, air] = await Promise.all([
    fetchForecast(lat, lon, FORECAST_DAYS),
    fetchAirQuality(lat, lon),
  ]);
  storage.saveWithTime(key, { forecast, air });
  return { forecast, air, savedAt: Date.now() };
}

// ---------- 이벤트 ----------

const picker = () => document.getElementById('picker');

function openPicker() {
  if (!picker().open) picker().showModal();
  document.getElementById('search-input').focus();
}

function bindEvents() {
  document.getElementById('days').addEventListener('click', (e) => {
    const btn = e.target.closest('.day');
    if (!btn || !view) return;
    view.selectedDate = btn.dataset.date;
    ui.renderDetail(view);
    document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  document.getElementById('change-place').addEventListener('click', openPicker);
  document.getElementById('close-picker').addEventListener('click', () => picker().close());

  document.getElementById('use-gps').addEventListener('click', async () => {
    picker().close();
    try {
      await useCurrentLocation();
    } catch (err) {
      ui.renderStatus(err.message, true);
    }
  });

  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    const status = document.getElementById('search-status');
    if (!query) return;
    status.textContent = '검색 중…';
    try {
      searchResults = await searchPlaces(query);
      status.textContent = searchResults.length ? '' : '검색 결과가 없어요';
    } catch (err) {
      searchResults = [];
      status.textContent = err.message;
    }
    ui.renderSearchResults(searchResults);
  });

  document.getElementById('search-results').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;
    picker().close();
    showPlace(searchResults[Number(btn.dataset.index)]);
  });
}

start();
