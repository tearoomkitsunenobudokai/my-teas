// ─────────────────────────────────────────────────────────
// アプリのバージョン情報（内部確認用）
//
// ★ リリースのたびに APP_VERSION を更新すること。
//   ここが唯一の定義箇所で、以下すべてに反映される:
//     ・管理者メニュー下部のバージョン表示（製作者・管理者のみ閲覧）
//     ・HTMLの <meta name="app-version"> （ログイン不要でソース表示から確認可能）
//
// BUILD_COMMIT / BUILD_TIME は Vercel でのビルド時に自動で入る。
// 「pushしたのに反映されていないのでは？」という確認に使える。
// ─────────────────────────────────────────────────────────

export const APP_VERSION = 'v286'

// Vercelが自動で提供する環境変数（ローカルでは undefined）
export const BUILD_COMMIT =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'

// next.config.js でビルド時刻を埋め込んでいる
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? ''

/** 「v200 (a1b2c3d / 2026-07-25 12:00 JST)」のような1行表記を返す */
export function versionLabel(): string {
  const parts: string[] = [APP_VERSION]
  const detail: string[] = []
  if (BUILD_COMMIT) detail.push(BUILD_COMMIT)
  if (BUILD_TIME) {
    const d = new Date(BUILD_TIME)
    if (!Number.isNaN(d.getTime())) {
      detail.push(
        new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(d) + ' JST'
      )
    }
  }
  if (detail.length) parts.push(`(${detail.join(' / ')})`)
  return parts.join(' ')
}
