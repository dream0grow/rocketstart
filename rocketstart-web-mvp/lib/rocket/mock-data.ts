import type { RocketTaskView } from './types'

export const mockRocketTasks: RocketTaskView[] = [
  {
    id: 'task-1',
    title: '웹 MVP 오늘 화면 만들기',
    stage: 'day1_structure',
    outcome90: '오늘 착수, 오늘 90% 마감, 복구 필요 카드가 보이는 화면',
    estimatedPomodoros: 4,
    actualPomodoros: 1,
    todayBucket: 'start',
    deliverables: [
      { id: 'd1', title: '오늘 착수 카드', required: true, weight: 35, status: 'done' },
      { id: 'd2', title: '90% 마감 카드', required: true, weight: 35, status: 'todo' },
      { id: 'd3', title: '복구 필요 카드', required: true, weight: 30, status: 'todo' }
    ]
  },
  {
    id: 'task-2',
    title: '뽀모도로 리포트 설계',
    stage: 'day3_90',
    outcome90: '예상 대비 실제 뽀모도로와 예측 정확도가 보이는 리포트',
    estimatedPomodoros: 6,
    actualPomodoros: 7,
    todayBucket: 'due90',
    deliverables: [
      { id: 'd4', title: '계산 공식', required: true, weight: 40, status: 'done' },
      { id: 'd5', title: '리포트 화면', required: true, weight: 40, status: 'done' },
      { id: 'd6', title: '성찰 질문', required: true, weight: 20, status: 'todo' }
    ]
  },
  {
    id: 'task-3',
    title: '랜딩페이지 초안',
    stage: 'recovery',
    outcome90: '사용자가 앱의 목적을 이해하고 대기 신청할 수 있는 초안',
    estimatedPomodoros: 3,
    actualPomodoros: 0,
    todayBucket: 'recovery',
    deliverables: [
      { id: 'd7', title: '문제 정의', required: true, weight: 40, status: 'todo' },
      { id: 'd8', title: '핵심 기능', required: true, weight: 40, status: 'todo' },
      { id: 'd9', title: 'CTA', required: true, weight: 20, status: 'todo' }
    ]
  }
]
