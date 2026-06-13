import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TeaNote — 紅茶評価アプリ',
  description: '紅茶をレーダーチャートで評価・共有できるアプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
