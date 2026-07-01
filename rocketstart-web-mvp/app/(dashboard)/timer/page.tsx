import { FocusTimer } from '@/components/timer/FocusTimer'

export default function TimerPage() {
  return (
    <section className="stack">
      <div>
        <h1>집중 타이머</h1>
        <p className="muted">완료한 세션은 실제 뽀모도로로 기록되어 예측 정확도 계산에 사용됩니다.</p>
      </div>
      <FocusTimer />
    </section>
  )
}
