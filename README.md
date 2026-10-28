# 🚿 세차 타이밍

"세차하면 다음날 비 온다"는 국룰을 피하기 위해, 현재 위치의 예보를 분석해 **세차하기 가장 좋은 날**을 추천하는 웹 앱.

## 실행

빌드 과정이 없는 순수 ES 모듈 앱입니다. ES 모듈과 위치 권한 때문에 `file://`로는 동작하지 않으니 로컬 서버로 여세요.

```bash
python -m http.server 5173
# → http://localhost:5173
```

- 위치 권한은 `localhost` 또는 HTTPS에서만 동작합니다.
- 특정 지역 바로 보기: `http://localhost:5173/?lat=37.64&lon=126.66&name=김포`
- 배포: 폴더 그대로 GitHub Pages / Netlify / Vercel 등 정적 호스팅에 올리면 됩니다.

## 테스트

```bash
node --test     # 또는 npm test (Node 18+)
```

## 구조

```
index.html            화면 뼈대
css/style.css         스타일 (라이트/다크 자동)
js/
  config.js           ★ 추천 로직 튜닝 값 (임계값, 가중치, 평가 기간)
  main.js             흐름 제어: 위치 → 날씨 → 점수 → 렌더, 이벤트 연결
  storage.js          localStorage 래퍼 (캐시, 마지막 위치)
  api/
    http.js           fetch + 타임아웃
    openMeteo.js      날씨/대기질 API
    geocode.js        현재 위치, 좌표→지역명, 지역 검색
  core/               ← DOM·네트워크 의존 없음 (테스트 대상)
    normalize.js      API 응답 → DayWeather[]
    scoring.js        점수 엔진
    messages.js       화면 문구, 날짜/날씨 표기
  ui/render.js        상태 → HTML
tests/scoring.test.js
```

## 추천 알고리즘

1. **하루 오염 확률 `d`** = max(강수확률, 눈 가중치, 황사/미세먼지 페널티)
   - 강수량 1mm 미만이면 이슬비로 보고 확률을 절반으로 낮춤
   - 적설 0.5cm 이상이면 눈으로 보고 ×1.3 (염화칼슘)
2. **깨끗하게 유지되는 날수의 기대값** `E = Σₖ Πⱼ≤ₖ (1 − dⱼ)` — 세차 다음 날부터 5일
3. **세차 당일 배수** — 세차 시간대(9~18시) 비, 결빙, 강풍, 폭염이면 감점. 오늘은 이미 지난 시간을 제외
4. **점수** = 100 × 당일 배수 × E/5 × 예보 신뢰도(하루당 −5%)
5. 7일 중 최고점인 날을 추천하고, 강수확률이 가장 낮은 3시간을 추천 시간대로 제시. 모두 30점 미만이면 "이번 주는 참으세요"

"국룰 발동 확률" = 오늘 세차했을 때 내일의 오염 확률.

## 자주 하는 수정

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 감점 기준, 가중치, 평가 기간 | `js/config.js` |
| 화면 문구 | `js/core/messages.js` |
| 반응형 배치 (휴대폰 / 640px 태블릿 / 1024px 데스크톱) | `css/style.css` 하단 미디어 쿼리 |
| 점수 공식 | `js/core/scoring.js` + 테스트 |
| 날씨 API 교체 (예: 기상청) | `js/api/`에 모듈 추가 → `normalize.js`가 같은 `DayWeather` 형식을 만들도록 |

## 데이터 출처

- 날씨·대기질: [Open-Meteo](https://open-meteo.com/) (키 불필요)
- 좌표→지역명: BigDataCloud reverse-geocode-client
- 지역 검색: [OpenStreetMap Nominatim](https://nominatim.org/) — 이용 정책상 자동완성 금지, 초당 1회 이하
