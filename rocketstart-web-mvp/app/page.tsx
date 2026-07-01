import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="shell">
      <section className="card stack">
        <span className="badge">RocketStart Web MVP</span>
        <h1>미루기 전에 시작하고, 막히면 복구하고, 다음 계획은 더 정확하게</h1>
        <p className="muted">
          3일 안에 90% 산출물까지 가도록 로켓 시작일, 산출물 체크리스트, 뽀모도로 예측, 성찰 메모를 묶습니다.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <Link className="button" href="/today">오늘의 로켓 보기</Link>
          <Link className="button secondary" href="/new-rocket">로켓 만들기</Link>
        </div>
      </section>
    </main>
  )
}
