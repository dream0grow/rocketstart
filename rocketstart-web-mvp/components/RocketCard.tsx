import { calculatePomodoroMetrics, calculateRequiredDeliverableProgress } from '@/lib/rocket/metrics'
import { stageLabel, type RocketTaskView } from '@/lib/rocket/types'

export function RocketCard({ task }: { task: RocketTaskView }) {
  const deliverableProgress = calculateRequiredDeliverableProgress(task.deliverables)
  const pomodoro = calculatePomodoroMetrics(task.estimatedPomodoros, task.actualPomodoros)

  return (
    <article className="card stack" style={{ boxShadow: 'none' }}>
      <div className="row">
        <h3>{task.title}</h3>
        <span className="badge">{stageLabel(task.stage)}</span>
      </div>
      <p className="muted">{task.outcome90}</p>
      <div>
        <div className="row"><span>산출물 90% 기준</span><span>{Math.round(deliverableProgress.percent)}%</span></div>
        <div className="progress"><div style={{ width: `${deliverableProgress.percent}%` }} /></div>
      </div>
      <div className="row"><span>예상 뽀모도로</span><span>{task.estimatedPomodoros}</span></div>
      <div className="row"><span>실제 뽀모도로</span><span>{task.actualPomodoros}</span></div>
      <div className="row"><span>예측 판단</span><span>{pomodoro.label}</span></div>
    </article>
  )
}
