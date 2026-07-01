export default function LoginPage() {
  return (
    <main className="shell">
      <section className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1>로그인</h1>
        <p className="muted">MVP에서는 Supabase Auth로 이메일, Google, Apple 로그인을 연결합니다.</p>
        <input className="input" placeholder="이메일" />
        <button className="button">이메일로 계속하기</button>
        <button className="button secondary">Google로 계속하기</button>
        <button className="button secondary">Apple로 계속하기</button>
      </section>
    </main>
  )
}
