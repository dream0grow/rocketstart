'use client'

import { useMemo, useState } from 'react'
import { BLOCKER_LABELS, type BlockerReason } from '@/lib/rocket/types'
import { mockRocketTasks } from '@/lib/rocket/mock-data'

// 막힘 이유별로 "다음 15분 최소 행동"을 부드럽게 제안합니다. (강요가 아니라 예시)
const MINIMUM_ACTION_HINTS: Record<BlockerReason, string> = {
  scope_too_big: '가장 작은 산출물 하나만 골라 15분만 손대기',
  not_enough_time: '지금 딱 15분만 타이머 켜고 시작하기',
  missing_materials: '필요한 자료 목록 3개만 적어보기',
  low_energy: '물 한 잔 마시고 5분 스트레칭 후 15분만',
  fear: '완성 말고 "초안 한 줄"만 써보기',
  perfectionism: '일부러 60점짜리 버전으로 15분만 만들기',
  schedule_conflict: '오늘 가능한 15분 시간대 하나만 정하기',
  unclear_next_action: '"다음에 할 일" 딱 한 문장으로 적기',
  other: '지금 할 수 있는 가장 작은 행동 하나 적기'
}

const BLOCKER_ORDER = Object.keys(BLOCKER_LABELS) as BlockerReason[]

export default function RecoveryPage() {
  // 복구가 필요한 로켓을 우선 보여주고, 없으면 전체에서 고릅니다.
  const recoveryTasks = useMemo(
    () => mockRocketTasks.filter((task) => task.todayBucket === 'recovery'),
    []
  )
  const selectableTasks = recoveryTasks.length > 0 ? recoveryTasks : mockRocketTasks

  const [taskId, setTaskId] = useState(selectableTasks[0]?.id ?? '')
  const [blocker, setBlocker] = useState<BlockerReason | null>(null)
  const [nextAction, setNextAction] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const canSave = taskId && blocker && nextAction.trim().length > 0

  function applyHint() {
    if (blocker) setNextAction(MINIMUM_ACTION_HINTS[blocker])
  }

  function save() {
    // MVP 2단계에서 이 값은 reflection_logs 테이블에 저장됩니다.
    // (trigger, blocker, note, next_minimum_action, task_id)
    setSaved(true)
  }

  if (saved) {
    const task = selectableTasks.find((item) => item.id === taskId)
    return (
      <section className="stack">
        <div className="card stack">
          <span className="badge">복구 완료</span>
          <h1>좋아요. 다시 점화했습니다 🚀</h1>
          <p className="muted">미룬 건 잘못이 아니라 신호였어요. 아래 최소 행동만 지금 해보세요.</p>
          <div className="card stack" style={{ boxShadow: 'none' }}>
            {task && <div className="row"><span>로켓</span><span>{task.title}</span></div>}
            {blocker && <div className="row"><span>막힘 이유</span><span>{BLOCKER_LABELS[blocker]}</span></div>}
            <div className="row"><span>다음 15분 최소 행동</span><span>{nextAction}</span></div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <a className="button" href="/timer">지금 15분 타이머 시작</a>
            <button className="button secondary" type="button" onClick={() => setSaved(false)}>다시 작성</button>
          </div>
          <p className="muted">저장 연결(reflection_logs)은 다음 마일스톤에서 붙습니다.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="stack">
      <div>
        <h1>복구 모드</h1>
        <p className="muted">
          미룬 이유를 짧게 고르고, 지금 할 수 있는 <strong>가장 작은 다음 행동 하나</strong>만 정합니다.
          방치 대신 재점화가 목표예요.
        </p>
      </div>

      <div className="grid">
        <div className="card stack">
          <h2>1. 어떤 로켓인가요</h2>
          <select className="select" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            {selectableTasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>

          <h2>2. 무엇이 막았나요</h2>
          <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {BLOCKER_ORDER.map((reason) => (
              <button
                key={reason}
                type="button"
                className={blocker === reason ? 'button' : 'button secondary'}
                onClick={() => setBlocker(reason)}
              >
                {BLOCKER_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h2>3. 다음 15분 최소 행동</h2>
          <textarea
            className="textarea"
            rows={3}
            placeholder="예: 가장 작은 산출물 하나만 15분 손대기"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
          />
          <button className="button secondary" type="button" onClick={applyHint} disabled={!blocker}>
            막힘 이유에 맞는 예시 넣기
          </button>

          <h2>메모 (선택)</h2>
          <textarea
            className="textarea"
            rows={2}
            placeholder="지금 느낌이나 상황을 한 줄로"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          <button className="button" type="button" onClick={save} disabled={!canSave}>
            복구 기록하고 다시 시작
          </button>
          {!canSave && <p className="muted">로켓 선택 · 막힘 이유 · 다음 행동을 채우면 저장됩니다.</p>}
        </div>
      </div>
    </section>
  )
}
