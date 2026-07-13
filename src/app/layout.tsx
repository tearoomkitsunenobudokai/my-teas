import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My-Teas — 紅茶評価アプリ',
  description: '紅茶をレーダーチャートで評価・共有できるアプリ',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // iOSでホーム画面に追加した際、全画面表示（standalone）で起動させるための設定
  appleWebApp: {
    capable: true,
    title: 'My-Teas',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1D9E75',
  width: 'device-width',
  initialScale: 1,
  // ピンチズームは有効のまま（視覚アクセシビリティのため無効化しない）
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Supabaseへの接続（DNS解決・TLS確立）をページ読み込みと並行して先回りする。
  // 各ページ最初のAPI呼び出しが100〜300ms程度速くなる。
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    <html lang="ja">
      <head>
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
