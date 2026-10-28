// 상태 → HTML. 이벤트 처리는 main.js가 담당한다.
import {
  dayLabel,
  shortDate,
  weatherInfo,
  scoreGrade,
  heroMessage,
  gukrulMessage,
  formatWindow,
} from '../core/messages.js';

const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pct = (p) => `${Math.round(p * 100)}%`;

const chip = (r) => `<span class="chip">${r.icon} ${esc(r.text)}</span>`;

export function renderPlace(name) {
  $('place-name').textContent = name;
}

/** @param {string | null} text */
export function renderStatus(text, isError = false) {
  const el = $('status');
  el.hidden = !text;
  el.textContent = text ?? '';
  el.classList.toggle('status--error', isError);
}

export function renderUpdated(savedAt) {
  const t = new Date(savedAt);
  $('updated').textContent = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')} 기준`;
}

export function clearResults() {
  for (const id of ['hero', 'today', 'days', 'detail']) $(id).innerHTML = '';
}

/**
 * @param {{
 *   days: import('../core/normalize.js').DayWeather[],
 *   results: import('../core/scoring.js').DayScore[],
 *   best: import('../core/scoring.js').DayScore | null,
 *   giveUp: boolean,
 *   selectedDate: string,
 * }} view
 */
export function renderResults(view) {
  $('hero').innerHTML = heroHtml(view.best, view.giveUp);
  $('today').innerHTML = view.results[0] ? todayHtml(view.results[0]) : '';
  $('days').innerHTML = view.results.map((r) => dayRowHtml(r, view)).join('');
  renderDetail(view);
}

export function renderDetail(view) {
  const result = view.results.find((r) => r.date === view.selectedDate);
  const day = view.days.find((d) => d.date === view.selectedDate);
  $('detail').innerHTML = result && day ? detailHtml(result, day, view.days) : '';
  for (const btn of document.querySelectorAll('.day')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.date === view.selectedDate));
  }
}

function heroHtml(best, giveUp) {
  if (!best) return `<div class="card hero"><p class="message">${esc(heroMessage(best, giveUp))}</p></div>`;
  const grade = scoreGrade(best.score);
  const window = best.window ? `<span>추천 <strong>${formatWindow(best.window)}</strong></span>` : '';
  return `
    <div class="card hero grade-${grade.key}">
      <p class="eyebrow">${giveUp ? '그나마 나은 날' : '🚿 베스트 세차일'}</p>
      <h1>${dayLabel(best.date, best.offset)} (${shortDate(best.date)})</h1>
      <div class="hero-stats">
        <span><span class="hero-score">${best.score}</span>점</span>
        <span><strong>${best.expectedCleanDays.toFixed(1)}일</strong> 유지 예상</span>
        ${window}
      </div>
      <p class="message">${esc(heroMessage(best, giveUp))}</p>
    </div>`;
}

function todayHtml(today) {
  const prob = today.nextDayDirt;
  const grade = scoreGrade(100 - prob * 100);
  return `
    <div class="card today grade-${grade.key}">
      <div class="today-prob">${pct(prob)}</div>
      <div>
        <h2>오늘 세차하면? 국룰 발동 확률</h2>
        <p class="muted">${esc(gukrulMessage(prob))}</p>
      </div>
    </div>`;
}

function dayRowHtml(r, view) {
  const day = view.days.find((d) => d.date === r.date);
  const info = weatherInfo(day?.weatherCode);
  const grade = scoreGrade(r.score);
  const chips = [];
  if (view.best && r.date === view.best.date && !view.giveUp) chips.push('<span class="chip chip--best">★ 추천</span>');
  if (r.window && r.washFactor > 0) chips.push(`<span class="chip">🕒 ${formatWindow(r.window)}</span>`);
  chips.push(...r.washReasons.map(chip));
  if (r.spoiler) {
    const what = r.spoiler.reasons[0]?.text ?? `오염 ${pct(r.spoiler.prob)}`;
    chips.push(chip({ icon: '⚠️', text: `${shortLabel(r.spoiler.date, view.days)} ${what}` }));
  }

  return `
    <li>
      <button type="button" class="card day grade-${grade.key}" data-date="${r.date}" aria-pressed="false">
        <span class="day-name">${dayLabel(r.date, r.offset)}<small>${shortDate(r.date)}</small></span>
        <span class="day-emoji" title="${info.label}">${info.emoji}</span>
        <span class="day-bar-row">
          <span class="bar" aria-hidden="true"><span style="width:${r.score}%"></span></span>
          <span class="day-score" aria-label="세차 지수 ${r.score}점">${r.score}</span>
        </span>
        ${chips.length ? `<span class="chips">${chips.join('')}</span>` : ''}
      </button>
    </li>`;
}

/** "내일", "모레", "토" 처럼 짧은 상대 날짜 */
function shortLabel(date, days) {
  const offset = days.findIndex((d) => d.date === date);
  return dayLabel(date, offset).replace('요일', '');
}

function detailHtml(r, day, days) {
  const info = weatherInfo(day.weatherCode);
  const fmt = (v, unit, digits = 0) => (v == null ? '–' : `${v.toFixed(digits)}${unit}`);
  const facts = [
    ['날씨', `${info.emoji} ${info.label}`],
    ['강수확률', fmt(day.precipProb, '%')],
    ['강수량', fmt(day.precipSum, 'mm', 1)],
    ['기온', day.tMin == null ? '–' : `${Math.round(day.tMin)}° / ${Math.round(day.tMax)}°`],
    ['최대 풍속', fmt(day.windMax, 'm/s', 1)],
    ['미세먼지', fmt(day.pm10Max, '㎍')],
  ];

  const survival = r.survival
    .map(
      (s) => `
      <li>
        <span>${shortLabel(s.date, days)} ${shortDate(s.date)}</span>
        <span class="bar"><span style="width:${s.prob * 100}%"></span></span>
        <span>${pct(s.prob)}</span>
      </li>`,
    )
    .join('');

  const reasons = r.washReasons.length
    ? `<h3>세차 당일 감점</h3><div class="chips">${r.washReasons.map(chip).join('')}</div>`
    : '';

  return `
    <div class="card detail">
      <h2>${dayLabel(r.date, r.offset)} (${shortDate(r.date)}) 상세 · ${r.score}점</h2>
      <dl class="facts">
        ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      ${reasons}
      <h3>이날 세차하면, 깨끗하게 남아 있을 확률</h3>
      <ul class="survival">${survival}</ul>
    </div>`;
}

/** @param {import('../api/geocode.js').Place[]} places */
export function renderSearchResults(places) {
  $('search-results').innerHTML = places
    .map(
      (p, i) =>
        `<li><button type="button" class="btn btn--ghost" data-index="${i}">${esc(p.name)}</button></li>`,
    )
    .join('');
}
