// 이 파일의 타입은 supabase/schema.sql 의 enum 과 "값"이 일치해야 합니다.
// (화면에 보여줄 한글은 아래 라벨 매핑으로 분리합니다 — DB 에는 영문 값이 저장됩니다.)

// schema.sql: sprint_day_policy = ('include','exclude','ask_each_rocket')
export type SprintDayPolicy = 'include' | 'exclude' | 'ask_each_rocket'

// 로켓을 실제로 계산(3일 스프린트)할 때 쓰는 구체적 정책은 두 가지뿐입니다.
// 'ask_each_rocket' 은 사용자 기본 설정값("매번 물어보기")이라 계산에는 쓰지 않습니다.
export type ConcreteSprintDayPolicy = 'include' | 'exclude'

// schema.sql: rocket_stage = ('planned','day1_structure','day2_build','day3_90','review','done','recovery','paused')
export type RocketStage =
  | 'planned'
  | 'day1_structure'
  | 'day2_build'
  | 'day3_90'
  | 'review'
  | 'done'
  | 'recovery'
  | 'paused'

// 화면 표시용 한글 라벨 (DB 값 → 사람이 읽는 말)
export const STAGE_LABELS: Record<RocketStage, string> = {
  planned: '예정',
  day1_structure: '1일차 구조 잡기',
  day2_build: '2일차 핵심 제작',
  day3_90: '3일차 90% 완성',
  review: '검토/보완',
  done: '최종 완료',
  recovery: '복구 필요',
  paused: '보류'
}

export function stageLabel(stage: RocketStage): string {
  return STAGE_LABELS[stage] ?? stage
}

// schema.sql: blocker_reason enum
export type BlockerReason =
  | 'scope_too_big'
  | 'not_enough_time'
  | 'missing_materials'
  | 'low_energy'
  | 'fear'
  | 'perfectionism'
  | 'schedule_conflict'
  | 'unclear_next_action'
  | 'other'

// 복구 모드에서 고르는 "막힘 이유" 한글 라벨 (선택 순서대로)
export const BLOCKER_LABELS: Record<BlockerReason, string> = {
  scope_too_big: '과업이 너무 큼',
  not_enough_time: '시간이 부족함',
  missing_materials: '자료가 부족함',
  low_energy: '에너지가 부족함',
  fear: '두려움',
  perfectionism: '완벽주의',
  schedule_conflict: '일정 충돌',
  unclear_next_action: '다음 행동이 불명확',
  other: '기타'
}

export type DeliverableStatus = 'todo' | 'doing' | 'done' | 'skipped'

export type Deliverable = {
  id: string
  title: string
  required: boolean
  weight: number
  status: DeliverableStatus
}

export type RocketTaskView = {
  id: string
  title: string
  stage: RocketStage
  outcome90: string
  estimatedPomodoros: number
  actualPomodoros: number
  deliverables: Deliverable[]
  todayBucket: 'start' | 'due90' | 'recovery' | 'progress'
}

export type PomodoroMetrics = {
  estimated: number
  actual: number
  usageRatio: number | null
  error: number | null
  accuracyScore: number | null
  label: '정확함' | '과소예측' | '과대예측' | '데이터 부족'
}
