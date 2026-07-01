import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <nav className="nav">
        <Link href="/today">오늘</Link>
        <Link href="/new-rocket">로켓 만들기</Link>
        <Link href="/timer">집중 타이머</Link>
        <Link href="/recovery">복구 모드</Link>
        <Link href="/report">리포트</Link>
        <Link href="/login">로그인</Link>
      </nav>
      {children}
    </main>
  )
}
