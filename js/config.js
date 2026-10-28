// 앱 전체에서 쓰는 튜닝 값. 추천 로직을 조정하려면 이 파일만 고치면 된다.
export const CONFIG = {
  /** 세차일 후보로 평가할 날 수 (오늘 포함) */
  evalDays: 7,
  /** 세차 후 며칠까지 "깨끗함 유지"를 계산할지 */
  lookaheadDays: 5,
  /** 세차하기 좋은 시간대 [시작, 끝) — 현지 시각 */
  daytimeHours: [9, 18],
  /** 추천 시간대 길이 (시간) */
  washWindowHours: 3,
  /** 날씨 캐시 유효 시간 */
  cacheTtlMs: 60 * 60 * 1000,
  /** 위치 요청 전체 제한 시간 (권한 팝업 대기 포함) */
  geoTimeoutMs: 15000,
  /** 위치를 못 얻고 저장된 위치도 없을 때 보여줄 지역 */
  defaultPlace: { lat: 37.64, lon: 126.66, name: '김포' },
  /** 먼 날일수록 예보 신뢰도를 깎는 비율 (하루당) */
  confidenceDecayPerDay: 0.05,
  /** 모든 날이 이 점수 미만이면 "이번 주는 참으세요" */
  giveUpScore: 30,

  /** 하루 동안 차가 더러워질 확률 계산용 */
  dirt: {
    drizzleMm: 1, // 강수량이 이보다 적으면 이슬비로 보고
    drizzleFactor: 0.5, // 확률을 이만큼 낮춘다
    snowMinCm: 0.5, // 적설이 이 이상일 때만 눈으로 취급
    snowWeight: 1.3, // 눈은 염화칼슘 때문에 더 치명적
    pm10Bad: 150, // µg/m³
    pm10Penalty: 0.3,
    dustBad: 100, // µg/m³ (황사)
    dustPenalty: 0.5,
    unknownProb: 0.3, // 강수확률 데이터가 없을 때 가정값
  },

  /** 세차 당일 조건에 따른 배수 */
  washDay: {
    rainProb: 40, // 낮 시간 최대 강수확률(%)이 이 이상이면
    rainFactor: 0.2,
    freezeTemp: 0, // 최저기온(°C)이 이 이하이면
    freezeFactor: 0.5,
    windMs: 10, // 최대 풍속(m/s)이 이 이상이면
    windFactor: 0.8,
    hotTemp: 32, // 최고기온(°C)이 이 이상이면
    hotFactor: 0.9,
  },
};

export const FORECAST_DAYS = CONFIG.evalDays + CONFIG.lookaheadDays;
