# AGENTS.md — 「100시간 공부」 인수인계 문서

이 문서는 이 앱을 이어서 개발할 사람/AI(예: Manus)를 위한 안내입니다.
저장소를 열면 **이 문서와 `study/` 폴더**만 보면 바로 작업을 시작할 수 있게 정리했습니다.

> ⚠️ 작업 범위는 **`study/` 폴더**입니다. 저장소의 `app/`(Electron 데스크톱), `src/`(Python)는
> 완전히 별개의 프로젝트이니 건드리지 마세요.

---

## 1. 프로젝트 개요
아이폰·아이패드에서 뽀모도로로 **100시간 공부**를 채우고, 매일 공부한 시간과 성찰을
기록하는 웹앱(PWA)입니다. 모든 데이터는 **100% 기기 안(localStorage)** 에만 저장되고
서버로 전송되지 않습니다.

## 2. 기술 스택 / 구조
- **빌드 없음**: 순수 HTML/CSS/JS. npm·프레임워크·번들러 **없음**.
- 스크립트는 `<script>`로 순서대로 로드하고, 전역 `window.App` 네임스페이스 하나로 모듈을 연결합니다.
- 파일 구성:
  ```
  study/
  ├── index.html            화면 구조 + iOS 메타
  ├── css/style.css         디자인(다크 톤, 반응형)
  ├── js/
  │   ├── store.js          데이터 저장/집계(localStorage) — 단일 진실 원천
  │   ├── timer.js          뽀모도로 타이머 엔진(집중↔휴식↔긴 휴식)
  │   ├── wakelock.js       화면 켜두기(Screen Wake Lock)
  │   ├── beep.js           완료음(Web Audio)
  │   ├── notify.js         타이머 종료 예약 알림 — Capacitor 앱에서만 동작, 웹에선 무동작(no-op)
  │   ├── progress.js       진행 화면 + 최근 7일 막대그래프
  │   ├── calendar.js       달력 + 날짜별 성찰 메모
  │   ├── settings.js       설정 + 백업(내보내기/가져오기)
  │   └── app.js            전체 연결 + 탭 전환 + 공용 함수(App.util)
  ├── manifest.webmanifest  설치 정보
  ├── sw.js                 서비스워커(오프라인 캐시)
  └── icons/                앱 아이콘
  ```

## 3. 데이터 모델 (localStorage 키 `study.v1`)
```json
{
  "schemaVersion": 1,
  "settings": {
    "focusMinutes": 25, "breakAfterN": 4, "breakMinutes": 10,
    "longBreakMinutes": 20, "longBreakEvery": 2,
    "goalHours": 100, "beepEnabled": true, "keepAwake": true
  },
  "sessions": [
    { "id": "...", "date": "YYYY-MM-DD", "startedAt": 0, "endedAt": 0, "seconds": 1500 }
  ],
  "reflections": { "YYYY-MM-DD": "성찰 메모" }
}
```
- **하루 총합·누적은 저장하지 않습니다.** `sessions`에서 매번 계산합니다(→ 데이터 불일치 없음).
- 시간은 **초 단위**로 저장하고, 화면에 보일 때만 시:분으로 포맷(`App.util.hm`).
- `store.js`의 함수만 통해 읽고 쓰세요: `getSettings/updateSettings`, `addSession`,
  `get/setReflection`, `totalSeconds`, `daySeconds`, `dailyTotals`, `exportJSON/importJSON`, `reset`.

## 4. 반드시 지킬 원칙
1. **로컬 100%** — 클라우드 API·서버 저장 금지. 데이터는 기기 밖으로 나가지 않습니다.
2. **개인 식별정보 저장 금지.**
3. **타이머 정확도** — 남은 시간은 `setInterval` 횟수가 아니라 **끝나는 시각(`Date.now()`) 기준**으로
   계산합니다. 아이폰에서 백그라운드/화면 잠금 후 복귀해도 정확해야 합니다. 이 방식 유지.
4. **최소 코드** — 과한 추상화 금지. 한 기능씩 완결.
5. **한국어 주석** — 개발자는 코딩 학습 중인 교사입니다. 친절한 한국어 주석을 답니다.

## 5. 실행 / 배포
- **로컬 실행**: `cd study && python3 -m http.server 8000` → `http://localhost:8000`
- **배포**: `.github/workflows/deploy-pages.yml`이 `main`의 `study/`를 GitHub Pages로 자동 배포.
  공개 주소: `https://dream0grow.github.io/rocketstart/`
- **코드를 바꾸면** `sw.js`의 `CACHE = "study-vN"` 버전을 **한 단계 올리세요**(예: v2 → v3).
  안 그러면 이미 설치한 기기가 예전 파일을 계속 씁니다.
- **아이폰 네이티브 앱**: 저장소의 `ios-app/` 폴더가 이 웹앱을 Capacitor로 포장합니다.
  `study/`를 고치면 맥에서 `cd ios-app && npm run sync` 후 Xcode로 다시 설치하면 반영됩니다.
  자세한 절차는 `ios-app/README.md` 참고.

## 6. 작업 방식
- **새 브랜치**에서 작업 → **PR 생성**. `main`에 직접 커밋 금지.
- 가능하면 브라우저(또는 헤드리스)로 실제 동작을 확인한 뒤 PR 올리기.

## 7. 다음 할 일 (백로그)
- [ ] 🔔 목표 달성률 축하 화면/배지 (25%·50%·100% 도달 시)
- [x] 📈 월간·전체 통계, 연속 공부일(streak) 표시 — 진행 화면에 구현됨
- [ ] 🏷️ 과목·태그별 공부시간 분류
- [ ] 🔁 긴 휴식 후 다음 공부 자동 시작 옵션
- [ ] 🌓 라이트/다크 테마 전환
- [ ] ⏰ 목표 종료 예상일(하루 평균 기준) 계산
- [x] 🔊 완료음 종류 선택, 진동(가능 기기) — 설정 화면에 구현됨
- [x] 📱 아이폰 네이티브 앱 1단계 (Capacitor 포장 + 잠금 화면 예약 알림) — `ios-app/` 참고
- [ ] 🔒 잠금 화면 라이브 액티비티 (실시간 타이머 표시 + 일시정지/재개 버튼, iOS 17+)
      — 애플 정책상 SwiftUI 전용 기능. 개발자의 Swift 학습 3단계(네이티브 재작성) 목표로 지정.
      타이머 엔진을 Swift로 옮겨야 하므로 Capacitor 포장본에 덧붙이지 말고 네이티브 버전에서 구현할 것.
