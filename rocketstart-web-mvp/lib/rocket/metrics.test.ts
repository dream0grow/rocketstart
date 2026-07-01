import { describe, expect, it } from 'vitest'
import { calculatePomodoroMetrics, calculateRequiredDeliverableProgress } from './metrics'

describe('calculateRequiredDeliverableProgress', () => {
  it('calculates progress using required deliverables only', () => {
    const result = calculateRequiredDeliverableProgress([
      { id: '1', title: 'A', required: true, weight: 70, status: 'done' },
      { id: '2', title: 'B', required: true, weight: 30, status: 'todo' },
      { id: '3', title: 'C', required: false, weight: 100, status: 'done' }
    ])
    expect(result.percent).toBe(70)
    expect(result.is90Done).toBe(false)
  })
})

describe('calculatePomodoroMetrics', () => {
  it('labels accurate estimates', () => {
    const result = calculatePomodoroMetrics(8, 9)
    expect(result.label).toBe('정확함')
  })

  it('labels underestimated work', () => {
    const result = calculatePomodoroMetrics(4, 7)
    expect(result.label).toBe('과소예측')
  })

  it('labels overestimated work', () => {
    const result = calculatePomodoroMetrics(8, 4)
    expect(result.label).toBe('과대예측')
  })

  it('returns null metrics when there is no actual session', () => {
    const result = calculatePomodoroMetrics(3, 0)
    expect(result.label).toBe('데이터 부족')
    expect(result.usageRatio).toBeNull()
    expect(result.accuracyScore).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns null metrics when there is no estimate', () => {
    const result = calculatePomodoroMetrics(0, 5)
    expect(result.label).toBe('데이터 부족')
    expect(result.usageRatio).toBeNull()
  })
})
