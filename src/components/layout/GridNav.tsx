'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './GridNav.module.css'

/*
 * 画面上部に置くアイコングリッド型のメニュー（v357）
 *
 * 従来の左サイドバーは、スマホだと本文の幅を奪ううえ、
 * 文字も小さく押しづらかったため、上部に横4×縦2で配置する形に変更した。
 *
 * ホームはヘッダー左上のロゴから遷移するため、ここには含めない（8個ちょうど）。
 * 管理者メニューは対象者が限られるので、グリッドとは分けて下に置く。
 *
 * 折りたたむと1列の小さいアイコン列になり、本文の縦幅を最大化できる。
 * 状態は localStorage に保存し、次回もその状態で開く。
 */

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/dashboard/reviews', label: '自分の評価', icon: '⭐' },
  { href: '/dashboard/community', label: 'コミュニティ', icon: '👥' },
  { href: '/dashboard/certified-shops', label: '認定店', icon: '🏅' },
  { href: '/dashboard/colors', label: 'カラーパレット', icon: '🎨' },
  { href: '/dashboard/ai-analysis', label: 'AI分析', icon: '🤖' },
  { href: '/dashboard/card-print', label: '印刷用に変換', icon: '🖨' },
  { href: '/dashboard/contact', label: 'お問い合わせ', icon: '✉️' },
]

const ADMIN = { href: '/dashboard/admin', label: '管理者メニュー', icon: '⚙️' }

const COLLAPSE_KEY = 'teanote_gridnav_collapsed'

export default function GridNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  function toggle() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  // 前方一致だと /dashboard がすべてに一致してしまうため、完全一致で判定する。
  // ただしAI分析は配下にページが分かれているので、そこだけ前方一致にする。
  function isActive(href: string): boolean {
    if (href === '/dashboard/ai-analysis') return pathname.startsWith(href)
    return pathname === href
  }

  const items = isAdmin ? [...NAV, ADMIN] : NAV

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        {collapsed ? (
          <div className={styles.rail}>
            {items.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={`${styles.railItem} ${isActive(href) ? styles.railActive : ''}`}>
                {icon}
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.cell} ${isActive(href) ? styles.cellActive : ''}`}>
                <span className={styles.cellIcon}>{icon}</span>
                <span className={styles.cellLabel}>{label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className={`${styles.toggleRow} ${collapsed ? styles.toggleRowCollapsed : ''}`}>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'メニューを開く' : 'メニューを閉じる'}>
            <span className={styles.chevron}>{collapsed ? '▼' : '▲'}</span>
            {collapsed ? 'メニュー' : '閉じる'}
          </button>
        </div>
      </div>
    </div>
  )
}
