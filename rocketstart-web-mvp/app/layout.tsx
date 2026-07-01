import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RocketStart',
  description: '미루기를 줄이는 3일 90% 산출물 스프린트 앱',
  manifest: '/manifest.json'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  )
}
