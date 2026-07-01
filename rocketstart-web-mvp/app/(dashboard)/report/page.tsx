import { mockRocketTasks } from '@/lib/rocket/mock-data'
import { calculatePomodoroMetrics, calculateRequiredDeliverableProgress } from '@/lib/rocket/metrics'

export default function ReportPage() {
  return (
    <section className="stack">
      <div>
        <h1>계획 정확도 리포트</h1>
        <p className="muted">산출물 달성률과 뽀모도로 예측 정확도를 분리해서 봅니다.</p>
      </div>
      <div className="grid">
        {mockRocketTasks.map((task) => {
          const progress = calculateRequiredDeliverableProgress(task.deliverables)
          const pomodoro = calculatePomodoroMetrics(task.estimatedPomodoros, task.actualPomodoros)
          return (
            <article className="card stack" key={task.id}>
              <h2>{task.title}</h2>
              <div className="row"><span>산출물 달성률</span><span>{Math.round(progress.percent)}%</span></div>
              <div className="row"><span>예상 뽀모도로</span><span>{pomodoro.estimated}</span></div>
              <div className="row"><span>실제 뽀모도로</span><span>{pomodoro.actual}</span></div>
              <div className="row"><span>사용률</span><span>{pomodoro.usageRatio === null ? '데이터 없음' : `${Math.round(pomodoro.usageRatio * 100)}%`}</span></div>
              <div className="row"><span>예측 정확도</span><span>{pomodoro.accuracyScore === null ? '데이터 없음' : `${Math.round(pomodoro.accuracyScore * 100)}점`}</span></div>
              <div className="row"><span>판단</span><span>{pomodoro.label}</span></div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
