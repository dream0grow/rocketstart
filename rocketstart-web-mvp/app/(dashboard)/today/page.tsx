import { RocketCard } from '@/components/RocketCard'
import { mockRocketTasks } from '@/lib/rocket/mock-data'

export default function TodayPage() {
  const todayStart = mockRocketTasks.filter((task) => task.todayBucket === 'start')
  const due90 = mockRocketTasks.filter((task) => task.todayBucket === 'due90')
  const recovery = mockRocketTasks.filter((task) => task.todayBucket === 'recovery')

  return (
    <section className="stack">
      <div>
        <h1>오늘의 로켓</h1>
        <p className="muted">오늘 시작할 일, 오늘 90%까지 밀어야 할 일, 복구가 필요한 일을 분리해서 보여줍니다.</p>
      </div>

      <div className="grid">
        <div className="card stack">
          <h2>오늘 착수</h2>
          {todayStart.map((task) => <RocketCard key={task.id} task={task} />)}
        </div>
        <div className="card stack">
          <h2>오늘 90% 마감</h2>
          {due90.map((task) => <RocketCard key={task.id} task={task} />)}
        </div>
        <div className="card stack">
          <h2>복구 필요</h2>
          {recovery.map((task) => <RocketCard key={task.id} task={task} />)}
        </div>
      </div>
    </section>
  )
}
