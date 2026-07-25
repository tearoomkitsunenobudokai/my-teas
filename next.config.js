/** @type {import('next').NextConfig} */

// アプリ全体に付与するセキュリティヘッダー。
// 破損リスクの高い CSP は含めていない（Supabase/chart.js/インラインSVG等の
// 検証が必要なため）。CSP を入れる場合は段階的に Report-Only から。
const securityHeaders = [
  // クリックジャッキング対策（同一オリジンのみフレーム許可）
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // MIMEタイプ推測の抑止
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // リファラは同一オリジンには送るが、外部にはオリジンのみ
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 不要な強力機能を無効化（地図等で位置情報を使う場合は geolocation を調整）
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=()' },
  // HTTPS強制（HSTS）。Vercel本番はHTTPS前提のため2年・サブドメイン込み。
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig = {
  // ビルド時刻を埋め込む（デプロイが反映されたかの確認に使う）
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
