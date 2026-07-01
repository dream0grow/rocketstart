# Manus 제작 가이드 — 로켓스타트

> Manus(AI 앱 빌더)에 그대로 붙여넣을 프롬프트 모음입니다. **중요: 이미 Next.js + Supabase 스타터(`rocketstart-web-mvp`)가 존재합니다.** 아래는 두 가지 경우로 나눠서 씁니다.
>
> - **A. 스타터를 이어서 개발할 경우** (권장) — 이미 화면 5개 뼈대·Supabase 스키마·계산 로직·백색소음이 있으므로, Manus에게 "이어서 만들어 달라"고 요청하는 프롬프트
> - **B. Manus로 새로 만들 경우** — 스타터 없이 처음부터 Manus가 전체를 생성하게 하는 경우 (스타터를 못 쓰는 환경이거나 완전히 새 사본을 만들 때만 사용)

먼저 어느 경우인지 정하고, 해당 섹션의 프롬프트만 사용하세요. 두 경우를 섞어서 쓰면 Manus가 중복 스키마·중복 컴포넌트를 만들 위험이 있습니다.

---

## 0. 공통 — 데이터 모델 JSON (모든 프롬프트에 붙여넣기)

아래 JSON은 화면·기능 프롬프트 어디에 넣어도 되는 "데이터 구조 고정" 블록입니다. Manus가 임의로 필드를 바꾸지 않도록, 프롬프트 맨 앞이나 뒤에 그대로 붙여넣으세요.

```json
{
  "Project": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "text",
    "goal": "text | null",
    "final_deadline": "date | null",
    "status": "text (default: active)"
  },
  "RocketTask": {
    "id": "uuid",
    "project_id": "uuid (Project 참조)",
    "title": "text",
    "outcome_90": "text (3일 안에 보여줄 90% 산출물 설명)",
    "rocket_start_date": "date",
    "day2_check_date": "date (자동 계산)",
    "target_90_date": "date (자동 계산, 시작일+2일)",
    "final_deadline": "date | null",
    "sprint_day_policy": "enum: include | exclude | ask_each_rocket",
    "stage": "enum: planned | day1_structure | day2_build | day3_90 | review | done | recovery | paused",
    "is_90_done": "boolean",
    "confirmed_90_at": "timestamp | null"
  },
  "Deliverable": {
    "id": "uuid",
    "task_id": "uuid (RocketTask 참조)",
    "title": "text",
    "description": "text | null",
    "is_required": "boolean",
    "weight": "number (>=0)",
    "status": "enum: todo | doing | done | skipped",
    "completed_at": "timestamp | null",
    "sort_order": "int"
  },
  "Subtask": {
    "id": "uuid",
    "task_id": "uuid (RocketTask 참조)",
    "deliverable_id": "uuid | null (Deliverable 참조)",
    "title": "text",
    "estimated_pomodoros": "number (>=0)",
    "status": "enum: todo | doing | done | skipped",
    "completed_at": "timestamp | null",
    "sort_order": "int"
  },
  "FocusSession": {
    "id": "uuid",
    "task_id": "uuid (RocketTask 참조)",
    "subtask_id": "uuid | null (Subtask 참조)",
    "started_at": "timestamp",
    "ended_at": "timestamp | null",
    "planned_minutes": "int (default 25)",
    "actual_minutes": "int | null",
    "completed_pomodoros": "number (default 0)",
    "sound_type": "enum: white | brown | rain | cafe | silent",
    "session_note": "text | null"
  },
  "ReflectionLog": {
    "id": "uuid",
    "task_id": "uuid | null (RocketTask 참조)",
    "session_id": "uuid | null (FocusSession 참조)",
    "trigger": "enum: not_started | session_done | missed_block | day_end | overdue_90 | manual",
    "blocker": "enum: scope_too_big | not_enough_time | missing_materials | low_energy | fear | perfectionism | schedule_conflict | unclear_next_action | other",
    "note": "text | null",
    "next_minimum_action": "text | null"
  },
  "계산식": {
    "필수_산출물_달성률": "sum(weight where is_required and status='done') / sum(weight where is_required)",
    "90퍼센트_완료_조건": "필수_산출물_달성률 >= 0.9 (그 후 사용자가 '90% 완료 확정' 버튼을 눌러야 최종 확정)",
    "예상_뽀모도로": "해당 로켓의 모든 Subtask.estimated_pomodoros 합계",
    "실제_뽀모도로": "해당 로켓에 연결된 완료 FocusSession.completed_pomodoros 합계",
    "사용률": "실제_뽀모도로 / 예상_뽀모도로",
    "예측오차": "실제_뽀모도로 - 예상_뽀모도로",
    "예측정확도": "1 - abs(실제_뽀모도로 - 예상_뽀모도로) / 예상_뽀모도로 (예상_뽀모도로가 0이면 null)",
    "판단_라벨": {
      "정확함": "실제가 예상의 75%~125%",
      "과소예측": "실제가 예상의 125% 초과",
      "과대예측": "실제가 예상의 75% 미만",
      "데이터_부족": "세션 없음 또는 예상이 0"
    }
  }
}
```

---

## A. 스타터를 이어서 개발할 경우 (권장)

스타터에는 이미 `/today`, `/new-rocket`, `/timer`, `/report`, `/(auth)/login` 화면 뼈대와 `supabase/schema.sql`, `lib/rocket/metrics.ts`, `lib/rocket/dates.ts`, 백색소음 컴포넌트가 들어있습니다. Manus에게는 "새로 만들지 말고 이 구조 위에서 이어서 작업하라"고 명확히 지시하세요.

### A-1. 프로젝트 컨텍스트 주입 (맨 처음 1번만)

```
이 저장소에는 이미 Next.js App Router + TypeScript + Supabase 기반의
"로켓스타트" 웹 앱 스타터가 있습니다.

- 화면 5개 뼈대: /today, /new-rocket, /timer, /report, /(auth)/login
- 공통 스타일: app/globals.css (--bg #f7f7f8, --text #18181b, 카드 radius 20px)
- 계산 로직: lib/rocket/metrics.ts, lib/rocket/dates.ts
- DB 스키마: supabase/schema.sql (RLS 정책 포함)
- 백색소음: components/timer/WhiteNoisePlayer.tsx

새 프로젝트를 처음부터 만들지 마세요. 기존 폴더 구조, 기존 클래스명
(.card, .button, .badge, .progress 등), 기존 타입(lib/rocket/types.ts)을
그대로 재사용하면서 이어서 개발해 주세요. 기존 파일을 지우거나
전면 재작성하지 말고, 필요한 부분만 수정/추가해 주세요.

제품 한 줄 정의: 로켓스타트는 미루기를 많이 하는 사람이 일을 시작한 뒤
3일 안에 필수 산출물 체크리스트 기준 90%까지 가도록 돕는 실행 관리 앱입니다.
90% 완료는 뽀모도로 사용량이 아니라 산출물 달성률로 판단하고,
뽀모도로는 예상 대비 실제를 기록해 예측 정확도를 학습하는 데 씁니다.
미루면 방치하지 않고 복구 모드(막힘 이유 + 다음 15분 최소 행동)로 전환합니다.

[여기에 위 0번 섹션의 데이터 모델 JSON 붙여넣기]
```

### A-2. Supabase CRUD 연결

```
supabase/schema.sql에 정의된 테이블(projects, rocket_tasks, deliverables,
subtasks, focus_sessions, reflection_logs)에 실제로 연결해 주세요.

1. /new-rocket 폼 제출 시 projects, rocket_tasks, deliverables, subtasks에
   실제로 insert 되도록 연결
2. /today 화면이 mock-data.ts 대신 실제 rocket_tasks + deliverables를
   조회하도록 전환. todayBucket(start/due90/recovery/progress) 분류는
   rocket_tasks.stage와 target_90_date를 기준으로 판단
3. /timer에서 세션 종료 시 focus_sessions에
   completed_pomodoros, actual_minutes, sound_type 저장
4. /report가 supabase/schema.sql에 이미 정의된
   rocket_task_metrics 뷰를 조회하도록 전환
5. RLS는 이미 "auth.uid() = user_id" 정책이 걸려 있으니 그대로 유지하고
   깨뜨리지 마세요.

lib/supabase/client.ts, lib/supabase/server.ts를 그대로 활용해 주세요.
```

### A-3. 복구 모드 화면 신규 추가

```
스타터에는 아직 /recovery 화면이 없습니다. app/(dashboard)/ 아래에
새 라우트로 추가해 주세요. 기존 화면들과 같은 레이아웃
(app/(dashboard)/layout.tsx)과 클래스(.card, .stack, .button 등)를
그대로 재사용하세요.

화면 내용:
1. 어떤 로켓이 막혔는지 선택 (rocket_tasks 중 stage='recovery'이거나
   사용자가 직접 선택)
2. 막힌 이유 선택 (단일 선택):
   미착수 / 과업 과다 / 자료 부족 / 에너지 부족 / 두려움 /
   완벽주의 / 일정 충돌 / 다음 행동 불명확 / 기타
   (blocker enum: not_started -> 미착수는 trigger 값이니 주의,
   blocker는 scope_too_big, not_enough_time, missing_materials,
   low_energy, fear, perfectionism, schedule_conflict,
   unclear_next_action, other 로 저장)
3. "다음 15분 동안 할 수 있는 가장 작은 행동은?" 텍스트 입력
4. 저장 버튼 -> reflection_logs에 insert (trigger='manual' 기본값,
   blocker, next_minimum_action, task_id 포함)
5. 저장 완료 후 "15분 타이머 바로 시작" 버튼 -> /timer로 이동하면서
   선택했던 로켓과 15분 값을 전달

톤: 다그치지 않기. "왜 안 했나요" 같은 문구 금지.
"멈춘 건 실패가 아니에요. 다시 불을 붙이는 질문 두 개만 할게요."
같은 부드러운 문구 사용. 복구 모드는 디자인-가이드.md의
--recovery-blue 톤을 적용해 주세요(오렌지·빨강 계열 쓰지 않기).
```

### A-4. 로그인 · PWA 마무리

```
1. Supabase Auth 이메일 로그인을 app/(auth)/login/page.tsx에 연결해 주세요.
   로그인 안 한 사용자가 (dashboard) 그룹 화면에 접근하면 /login으로
   리다이렉트되게 해주세요.
2. Google OAuth 로그인 버튼 추가
3. public/manifest.json 작성 (앱 이름: 로켓스타트, 테마색: 기존 --bg,
   아이콘은 로켓 이모지 기반 간단 아이콘)
4. 최소한의 service worker로 정적 자산 캐싱만 적용해 주세요
   (오프라인에서 완전 동작할 필요는 없음, PWA 설치 가능 수준이면 충분)
```

### A-5. 수정 요청 문구 모음 (스타터 이어가기용)

```
- "이 화면에서 기존 .card, .button 클래스를 벗어나지 말고 수정해 주세요."
- "lib/rocket/metrics.ts의 계산 함수는 건드리지 말고, 화면에서 부르는
  방식만 바꿔주세요."
- "supabase/schema.sql 테이블 구조는 바꾸지 말고, 마이그레이션이
  필요하면 새 파일로 추가해 주세요."
- "todayBucket 분류 로직을 클라이언트가 아니라 Supabase 쿼리/뷰로
  옮겨주세요."
- "복구 모드 톤이 너무 딱딱해요. 사용자를 탓하는 느낌의 문구를
  디자인-가이드.md의 마이크로카피 표를 참고해서 다시 써주세요."
- "이 변경으로 기존 5개 화면 중 하나라도 깨졌으면 원래대로 되돌리고
  다시 알려주세요."
```

---

## B. Manus로 새로 만들 경우 (스타터 없이 처음부터)

스타터를 쓸 수 없는 환경이거나, 완전히 새 사본으로 처음부터 만들고 싶을 때만 사용하세요.

### B-1. 전체 앱 한 방 프롬프트

```
"로켓스타트"라는 웹 앱을 만들어 주세요.

제품 정의: 미루기를 많이 하는 사람이 일을 시작한 뒤 3일 안에
"90% 산출물"까지 가도록 돕는 실행 관리 웹 앱입니다.

핵심 원칙 3가지:
1. 90% 완료는 뽀모도로 사용량이 아니라 필수 산출물 체크리스트
   달성률로 판단합니다.
2. 뽀모도로는 완료 기준이 아니라 계획 예측 정확도를 학습하는
   데이터로 추적합니다(예상 vs 실제).
3. 미루면 미완료로 방치하지 않고 복구 질문(막힘 이유 + 다음 15분
   최소 행동)으로 전환합니다.

기술 스택: Next.js (App Router) + TypeScript + Supabase(Auth, Postgres,
RLS) + PWA(manifest, service worker). 결제·팀 협업·네이티브 앱은
만들지 마세요.

데이터 모델은 아래 JSON을 정확히 그대로 따라주세요. 필드명을
임의로 바꾸지 마세요.
[여기에 0번 섹션의 데이터 모델 JSON 붙여넣기]

화면은 아래 5개 + 로그인 화면을 만들어 주세요(우선순위 순):
1. 오늘 화면 (/today) — 오늘 착수 / 오늘 90% 마감 / 복구 필요 /
   진행 중 로켓을 버킷으로 분리 표시. 각 카드에 산출물 달성률
   진행바, 예상·실제 뽀모도로, 스테이지 표시.
2. 로켓 만들기 (/new-rocket) — 프로젝트·로켓 목표·90% 산출물
   체크리스트·산출물별 하위과업·하위과업별 예상 뽀모도로·
   로켓 시작일·3일 계산 방식(주말 포함/제외/로켓마다 물어보기).
   90% 목표일과 총 예상 뽀모도로를 자동 계산해 보여주세요.
3. 집중 타이머 (/timer) — 15분 최소 시작 / 25분 기본 / 50분 깊은
   작업 / 사용자 지정. 백색소음(화이트/브라운/빗소리/카페/무음).
   완료 세션은 실제 뽀모도로로 기록. 어느 로켓을 집중할지 선택.
4. 복구 모드 (/recovery) — 막힘 이유 선택(미착수/과업 과다/자료
   부족/에너지 부족/두려움/완벽주의/일정 충돌/다음 행동 불명확/기타)
   → "다음 15분 최소 행동" 작성 → 저장.
5. 리포트 (/report) — 프로젝트별·로켓별 예상 대비 실제 뽀모도로,
   예측 정확도, 산출물 달성률.

디자인 톤: 흑백 담백한 기본 톤(배경 #f7f7f8, 텍스트 #18181b,
카드 흰색·radius 20px, 옅은 그림자) + 로켓 발사 포인트 컬러
1~2개(발사/진행 강조용 오렌지, 복구 모드 전용 차분한 블루)만
좁은 영역에 사용. "평가"가 아니라 "거울" 톤으로, 사용자를 탓하지
않는 문구를 써주세요.

3일 스프린트: 로켓 시작일 기준 day1 / day2 / target_90(2일 뒤)으로
자동 계산해 주세요.
```

### B-2. 화면별 프롬프트 (개별로 나눠서 요청할 때)

**오늘 화면**
```
/today 화면을 만들어 주세요. rocket_tasks를 조회해서 4개 버킷으로
나눠 보여주세요: 오늘 착수, 오늘 90% 마감, 복구 필요, 진행 중.
각 로켓 카드에는 제목, 스테이지 뱃지, 필수 산출물 달성률 진행바
(completed_required_weight / total_required_weight), 예상 뽀모도로
합계, 실제 뽀모도로 합계를 표시해 주세요. 로켓이 하나도 없을 때는
"아직 발사 대기 중인 로켓이 없어요" + 로켓 만들기 버튼을 보여주세요.
```

**로켓 만들기**
```
/new-rocket 화면을 만들어 주세요. 입력 항목: 프로젝트명, 로켓
태스크명, 3일 안에 보여줄 90% 산출물 설명, 로켓 시작일, 3일 계산
방식(주말 포함/제외). 90% 산출물 체크리스트를 여러 개 추가할 수
있게 하고, 각 산출물마다 필수 여부, 가중치(weight), 하위과업
목록과 하위과업별 예상 뽀모도로를 입력받으세요. 시작일과 계산
방식이 바뀌면 90% 목표일(target_90_date, 시작일+2일)과 총 예상
뽀모도로 합계를 실시간으로 자동 계산해서 보여주세요.
```

**집중 타이머**
```
/timer 화면을 만들어 주세요. 15분/25분/50분 버튼과 사용자 지정
분 입력을 제공하세요. 어느 로켓(및 선택적으로 어느 하위과업)에
집중할지 먼저 선택하게 하세요. 타이머 진행 중 화이트노이즈,
브라운노이즈, 빗소리, 카페소리, 무음 중 하나를 재생할 수 있게
하세요(Web Audio API 또는 오디오 파일 루프). 세션이 끝나면
completed_pomodoros, actual_minutes, sound_type을 focus_sessions에
기록하세요.
```

**복구 모드**
```
/recovery 화면을 만들어 주세요. 막힌 로켓을 선택하게 하고, 막힌
이유를 아래 9개 중 하나 고르게 하세요: 미착수, 과업 과다, 자료
부족, 에너지 부족, 두려움, 완벽주의, 일정 충돌, 다음 행동 불명확,
기타. 그다음 "다음 15분 동안 할 수 있는 가장 작은 행동은?"을
텍스트로 입력받고 reflection_logs에 저장하세요. 다그치는 문구를
쓰지 말고, "멈춘 건 실패가 아니에요"처럼 부드러운 톤을 써주세요.
저장 후에는 15분 타이머로 바로 이동할 수 있는 버튼을 보여주세요.
```

**리포트**
```
/report 화면을 만들어 주세요. 프로젝트별, 로켓별로 예상 뽀모도로,
실제 뽀모도로, 사용률, 예측오차, 예측정확도, 판단 라벨(정확함/
과소예측/과대예측/데이터 부족)과 필수 산출물 달성률을 보여주세요.
계산식은 아래를 정확히 따라주세요.
[여기에 0번 섹션의 계산식 JSON 붙여넣기]
완료된 로켓이 없으면 "아직 리포트로 보여줄 데이터가 없어요" 빈
상태를 보여주세요.
```

### B-3. 데이터 구조 지정 프롬프트 (스키마 생성용)

```
Supabase Postgres 스키마를 아래 데이터 모델대로 만들어 주세요.
모든 테이블에 user_id(auth.users 참조)를 두고, "user_id = auth.uid()"
기준 RLS 정책을 모든 테이블에 적용해 주세요.

[여기에 0번 섹션의 데이터 모델 JSON 붙여넣기]

추가로, rocket_task_metrics라는 뷰를 만들어서 로켓별
estimated_pomodoros 합계, actual_pomodoros 합계, 사용률, 예측정확도,
completed_required_weight, required_weight, deliverable_progress_ratio를
미리 계산해서 조회할 수 있게 해주세요. 예상이 0이면 사용률과
예측정확도는 null로 처리해 주세요.
```

### B-4. 수정 요청 문구 모음 (신규 생성용)

```
- "복구 모드 화면의 톤이 사용자를 탓하는 느낌이에요. 더 부드럽게
  다시 써주세요."
- "90% 완료 조건은 뽀모도로 개수가 아니라 반드시 필수 산출물
  달성률로만 판단해 주세요."
- "판단 라벨 기준(정확함 75~125%, 과소예측 125% 초과, 과대예측
  75% 미만, 데이터 부족)을 정확히 지켜주세요. 임의로 바꾸지 마세요."
- "복구 모드 색상에는 오렌지·빨강을 쓰지 말고 차분한 블루 계열만
  써주세요."
- "홈 화면(오늘 화면)에 공문/창업 아이디어 같은 다른 개념을 넣지
  말아주세요. 이 앱은 오직 로켓(작업) 실행 관리 앱입니다."
- "이 화면만 다시 만들어주세요. 다른 화면은 건드리지 마세요."
```

---

## 어느 경우를 선택해야 할지 모르겠다면

- 이미 `rocketstart-web-mvp` 폴더가 있고 로컬에서 실행이 된다 → **A(이어서 개발)**
- 스타터 폴더가 없거나, Manus 안에서 완전히 새로운 사본을 실험해보고 싶다 → **B(새로 만들기)**
- 둘 다 시도해보고 싶다면, B는 별도의 새 폴더/새 Manus 프로젝트에서 진행하고 A의 스타터와 절대 같은 저장소에 섞지 마세요.

---

앞 문서: [디자인-가이드.md](./디자인-가이드.md) · [와이어프레임.md](./와이어프레임.md) · [개발-로드맵.md](./개발-로드맵.md)
