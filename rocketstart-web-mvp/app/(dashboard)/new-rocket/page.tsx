'use client'

import { useMemo, useState } from 'react'
import { addRocketDays } from '@/lib/rocket/dates'
import type { ConcreteSprintDayPolicy } from '@/lib/rocket/types'

type DeliverableDraft = { title: string; weight: number; estimatedPomodoros: number }

export default function NewRocketPage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [policy, setPolicy] = useState<ConcreteSprintDayPolicy>('include')
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([
    { title: '90% 산출물 기준 1', weight: 50, estimatedPomodoros: 2 },
    { title: '90% 산출물 기준 2', weight: 50, estimatedPomodoros: 2 }
  ])

  // 항목 하나만 불변(immutable)하게 갱신 — 기존 객체를 직접 수정하지 않습니다.
  function updateDeliverable(index: number, patch: Partial<DeliverableDraft>) {
    setDeliverables((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const target90Date = useMemo(() => addRocketDays(startDate, 2, policy), [startDate, policy])
  const totalEstimate = deliverables.reduce((sum, item) => sum + item.estimatedPomodoros, 0)

  return (
    <section className="stack">
      <div>
        <h1>로켓 만들기</h1>
        <p className="muted">90% 완료 기준을 먼저 산출물 체크리스트로 쪼개고, 각 산출물의 예상 뽀모도로를 입력합니다.</p>
      </div>

      <div className="grid">
        <form className="card stack">
          <label className="stack">
            프로젝트명
            <input className="input" placeholder="예: 로켓스타트 웹 MVP" />
          </label>
          <label className="stack">
            로켓 태스크명
            <input className="input" placeholder="예: 오늘 화면과 타이머 MVP 만들기" />
          </label>
          <label className="stack">
            3일 안에 보여줄 90% 산출물
            <textarea className="textarea" rows={4} placeholder="예: 실제로 클릭 가능한 웹 MVP 초안" />
          </label>
          <label className="stack">
            로켓 시작일
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="stack">
            3일 계산 방식
            <select className="select" value={policy} onChange={(event) => setPolicy(event.target.value as ConcreteSprintDayPolicy)}>
              <option value="include">주말과 휴일 포함</option>
              <option value="exclude">주말 제외</option>
            </select>
          </label>
        </form>

        <div className="card stack">
          <h2>90% 산출물 체크리스트</h2>
          {deliverables.map((item, index) => (
            <div className="card stack" key={index} style={{ boxShadow: 'none' }}>
              <input
                className="input"
                value={item.title}
                onChange={(event) => updateDeliverable(index, { title: event.target.value })}
              />
              <label className="stack">
                가중치
                <input
                  className="input"
                  type="number"
                  value={item.weight}
                  min={0}
                  onChange={(event) => updateDeliverable(index, { weight: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="stack">
                예상 뽀모도로
                <input
                  className="input"
                  type="number"
                  value={item.estimatedPomodoros}
                  min={0}
                  onChange={(event) => updateDeliverable(index, { estimatedPomodoros: Number(event.target.value) || 0 })}
                />
              </label>
            </div>
          ))}
          <button className="button secondary" type="button" onClick={() => setDeliverables([...deliverables, { title: '새 산출물', weight: 10, estimatedPomodoros: 1 }])}>
            산출물 추가
          </button>
        </div>

        <div className="card stack">
          <h2>자동 계산</h2>
          <div className="row"><span>90% 목표일</span><span>{target90Date}</span></div>
          <div className="row"><span>총 예상 뽀모도로</span><span>{totalEstimate}</span></div>
          <button className="button" type="button">저장 연결은 다음 마일스톤</button>
        </div>
      </div>
    </section>
  )
}
