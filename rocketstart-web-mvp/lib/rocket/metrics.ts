import type { Deliverable, PomodoroMetrics } from './types'

export function calculateRequiredDeliverableProgress(deliverables: Deliverable[]) {
  const required = deliverables.filter((item) => item.required)
  const totalWeight = required.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (totalWeight === 0) {
    return { percent: 0, completedWeight: 0, totalWeight: 0, is90Done: false }
  }
  const completedWeight = required
    .filter((item) => item.status === 'done')
    .reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  const percent = Math.min(100, (completedWeight / totalWeight) * 100)
  return { percent, completedWeight, totalWeight, is90Done: percent >= 90 }
}

export function calculatePomodoroMetrics(estimated: number, actual: number): PomodoroMetrics {
  // 예상이 없거나(=0) 실제 세션이 하나도 없으면(actual<=0) '데이터 부족'.
  // 이 경우 사용률·정확도를 0 이 아니라 null 로 돌려 리포트가 "데이터 없음"으로 일관 표시되게 합니다.
  if (estimated <= 0 || actual <= 0) {
    return {
      estimated,
      actual,
      usageRatio: null,
      error: null,
      accuracyScore: null,
      label: '데이터 부족'
    }
  }

  const usageRatio = actual / estimated
  const error = actual - estimated
  const accuracyScore = Math.max(0, 1 - Math.abs(error) / estimated)
  let label: PomodoroMetrics['label'] = '정확함'

  // 실제가 예상의 125% 초과면 과소예측(더 오래 걸림), 75% 미만이면 과대예측(더 빨리 끝남)
  if (usageRatio > 1.25) label = '과소예측'
  else if (usageRatio < 0.75) label = '과대예측'

  return { estimated, actual, usageRatio, error, accuracyScore, label }
}

export function aggregatePomodoroEstimates(items: Array<{ estimatedPomodoros: number; actualPomodoros: number }>) {
  return items.reduce(
    (total, item) => ({
      estimated: total.estimated + item.estimatedPomodoros,
      actual: total.actual + item.actualPomodoros
    }),
    { estimated: 0, actual: 0 }
  )
}
