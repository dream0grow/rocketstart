# RocketStart Web MVP

로켓스타트 웹 MVP 1단계 스타터입니다.

목표는 노션 없이 다음 루프가 작동하는 웹 앱을 먼저 만드는 것입니다.

1. 프로젝트를 만든다
2. 90% 산출물 체크리스트를 만든다
3. 하위 과업과 예상 뽀모도로를 잡는다
4. 로켓 시작일을 정한다
5. 앱이 3일 스프린트와 오늘 화면을 만든다
6. 뽀모도로 타이머로 실제 사용량을 기록한다
7. 예상 대비 실제 뽀모도로 차이를 추적한다
8. 미루면 복구 질문과 성찰 메모를 남긴다

## 권장 스택

- Next.js App Router
- TypeScript
- Supabase Auth, Postgres, RLS
- Google Calendar API 연동은 MVP 후반
- PWA manifest와 service worker는 초기부터 포함

## 실행 순서

```bash
cp .env.example .env.local
npm install
npm run dev
```

Supabase SQL은 `supabase/schema.sql`부터 실행합니다.

## 핵심 MVP 화면

- `/today`: 오늘의 로켓
- `/new-rocket`: 로켓 만들기
- `/timer`: 집중 타이머와 백색소음
- `/report`: 뽀모도로 예측 정확도 리포트
- `/login`: 로그인 화면 초안

## 아직 구현해야 하는 것

이 스타터는 제품 구조와 핵심 로직을 빠르게 구현하기 위한 출발점입니다.
실제 Supabase 연결, Google Calendar OAuth, Web Push 서버 액션은 다음 단계에서 붙이면 됩니다.
