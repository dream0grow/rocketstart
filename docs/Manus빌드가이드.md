# Manus(또는 AI 빌더)로 MVP 앱 만들기 — 빌드 가이드

> 목적: 이미 완성된 **규칙 추출 코어(MVP-1~4, 파이썬)** 위에, 설계서 와이어프레임대로
> **화면(UI)이 있는 데스크톱 앱**을 Manus 같은 AI 빌더로 만들 때 그대로 주는 지시서입니다.
> 이 문서 하나 + `docs/` + `prototype/dashboard.html` 을 Manus 에 함께 주면 됩니다.

---

## 0. 지금 있는 것 / 만들 것

| 구분 | 상태 |
|---|---|
| **규칙 추출 코어** (파일→텍스트·마감일·교무수첩 카드) | ✅ 완성 (`src/`, 파이썬) |
| **AI 요약·할일** (로컬 Ollama) | ✅ 완성 (`src/ai/`) |
| **홈 대시보드 시각 프로토타입** | ✅ `prototype/dashboard.html` (참고 디자인) |
| **화면 있는 데스크톱 앱** (Electron+React) | ⬜ 이번에 Manus 로 만들 것 |

**핵심 전략**: 로직을 다시 짜지 말 것. 파이썬 코어를 **그대로 엔진으로 쓰고**, 그 위에 화면만 얹습니다.

---

## 1. 기술 스택 (설계서 확정)

- **플랫폼**: Electron (1차) — 개발 쉽고 AI 지원 풍부. 나중에 Tauri 이주.
- **UI**: React + Tailwind CSS + shadcn/ui
- **엔진**: 기존 파이썬 코어(`src/`)를 Electron 이 **자식 프로세스로 실행**해 JSON 을 주고받음.
  - Electron(메인) → `python -m src.extract "파일" --json` 실행 → stdout 의 JSON 파싱 → React 로 표시.
  - AI 포함 시 `--ai` 옵션. (Ollama 는 localhost 로컬)
- **로컬 저장**: SQLite (카드·상태·우선순위 저장). 원문·개인정보는 저장하지 않음.
- **절대 원칙**: 클라우드 API 금지. 모든 처리 로컬. 식별정보 비저장.

---

## 2. 데이터 계약 (파이썬 코어가 주는 JSON) ★가장 중요★

React 는 아래 형태의 JSON 만 알면 됩니다. (`python -m src.extract "파일" --json` 출력)

```json
{
  "filename_info": { "recipient","doc_number","kind","sender","title","extension","matched" },
  "deadline_info": {
    "has_deadline": true,
    "primary": { "iso":"2026-07-03","label":"신청기한","raw":"2026. 7. 3." },
    "deadlines": [ ... ], "all_dates": [ ... ]
  },
  "notebook": {
    "title","sender","doc_number","kind","extension","sender_level",
    "category": "할일형|배포형|참고형|규정형",
    "category_reason","placement","task_type",
    "deadline_iso","deadline_label","deadline_raw","d_day","d_day_text","other_deadlines",
    "is_image","stale_dropped"
  },
  "ai": {
    "available": true, "model":"qwen2.5:3b",
    "summary","summary_evidence",
    "tasks": [ {"text","evidence"} ],
    "notice": "AI가 제안한 내용입니다. 반드시 확인해 주세요.",
    "message"
  },
  "text": "본문 전체", "char_count": 123, "ok": true, "message": "추출 성공"
}
```

> 실제 샘플: 저장소 생성 스크립트로 `python -m src.extract "공문.hwp" --json` 하면 그대로 나옵니다.
> **UI 는 이 계약만 지키면 되고, 추출 로직은 절대 다시 만들지 않습니다.**

---

## 3. 만들 화면 (설계서 와이어프레임 순서)

전체: 좌측 고정 메뉴 + 우측 작업영역. 상단 바에 **🔒 로컬 작동중** 항상 표시.

1. **홈 대시보드** ★먼저★ — 아이젠하워 5칸 칸반. `prototype/dashboard.html` 이 이미 이 화면의 완성된 모습입니다. **이걸 React 로 옮기면 됩니다.**
   - 🔴 안급하지만 중요(가장 먼저!) / 🟡 급함+중요 / 🟠 급함(덜중요) / 🟢 해야할일 / ⚪ 기타
   - 카드: 제목·D-day 배지·성격 태그. 클릭 → 상세(요약·마감·원본 열기). 드래그로 칸 이동.
   - 상단 요약 띠: 오늘 할일 N · 이번 주 마감 N · 지난 마감 N⚠
2. **들어온 공문** — 드래그&드롭 영역 + 다운로드 폴더 감시 토글 + 목록(제목/한줄요약/발신/마감/형식/상태).
3. **교무수첩** — 카드 목록(우선순위·D-day·세부 할일 체크박스). 우선순위 수동 조정(드래그).
4. 공문 작성(RAG) · 회의록 · 배포·수합 · 과거공문 · 설정 — 이후 단계.

와이어프레임 상세는 설계서(와이어프레임 문서)와 `docs/교무수첩규칙.md`·`docs/마감일규칙.md` 참고.

---

## 4. 아이젠하워 자동 배치 규칙 (이미 구현됨 — `prototype/build_prototype.py` 참고)

```
할일형이 아니면            → ⚪ 기타(자료실·배포함)
할일형 + 마감 3일이내 + 중요 → 🟡 급함+중요
할일형 + 마감 여유  + 중요   → 🔴 안급하지만 중요 (가장 먼저!)
할일형 + 마감 3일이내 + 덜중요 → 🟠 급함(덜중요)
그 외                      → 🟢 해야할일
(중요 = 상급기관 발신 or 업무유형 연수/행사/보고)
```

---

## 5. Manus 에 그대로 붙여넣을 지시 프롬프트

```
너는 Electron + React + Tailwind + shadcn/ui 로 윈도우 데스크톱 앱을 만든다.
이름은 "교무부장 도우미". 절대 원칙: 100% 로컬, 클라우드 API 금지, 개인정보 비저장.

이미 파이썬 추출 엔진(src/)이 있다. 로직을 다시 짜지 말고, Electron 메인에서
  python -m src.extract "<파일경로>" --json   (AI 포함 시 --ai)
를 자식 프로세스로 실행해 stdout 의 JSON(§2 데이터 계약)을 받아 화면에 표시하라.

먼저 '홈 대시보드' 화면부터 만들어라. 디자인·배치는 첨부한 prototype/dashboard.html
과 똑같이 하되 React 컴포넌트로 옮겨라 (아이젠하워 5칸, 카드, 상세 모달, 상단 요약 띠,
좌측 메뉴, 🔒 로컬 작동중 표시). 카드 드래그로 칸 이동을 추가하고, 상태는 SQLite 에 저장하라.
그다음 '들어온 공문'(드래그&드롭 → 엔진 실행 → 목록), '교무수첩' 순으로 만들어라.
```

첨부물: 이 문서 + `prototype/dashboard.html` + `docs/*.md` + `src/` 전체.

---

## 6. 체크리스트 (Manus 산출물 검수)
- [ ] `--json` 출력을 그대로 소비하는가 (추출 로직 재구현 금지)
- [ ] 홈 대시보드가 프로토타입과 같은 배치·색·5칸인가
- [ ] 🔒 로컬 작동중 표시 / 네트워크 호출 없음(Ollama 제외, 그것도 localhost)
- [ ] 카드 상세에 "AI 제안 — 확인 필요" 문구가 있는가
- [ ] 마감일·발신기관은 규칙 값(정확)을 쓰고 AI 값을 쓰지 않는가
