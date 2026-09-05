'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './GridNav.module.css'

/*
 * 画面上部に置くアイコングリッド型のメニュー（v357 / v362で構成を変更）
 *
 * 従来の左サイドバーは、スマホだと本文の幅を奪ううえ、
 * 文字も小さく押しづらかったため、上部に横4×縦2で配置する形に変更した。
 *
 * ★ 枠は常に8個（横4×縦2）で固定する。増減するとレイアウトが崩れるため、
 *   項目を足したいときは SubNav のタブ側で受けること。
 *   - 統計は「ホーム」の下位画面として SubNav に置いた
 *   - 管理者メニューは対象者が限られるためヘッダーの歯車に移した
 *
 * 折りたたむと1列の小さいアイコン列になり、本文の縦幅を最大化できる。
 * 状態は localStorage に保存し、次回もその状態で開く。
 */

// アイコンは /public/icons/nav/ のSVG（v396で絵文字から差し替え、v397で絵柄を刷新）。
// 差し替える場合は同名のファイルを置き換えるだけでよい。
const NAV = [
  // ラベルは4列に収まるよう短めにしている（折り返すと行が増えて高さを取るため）
  // ホームの下にある「統計」へは、SubNav のタブから移動する（v362）
  { href: '/dashboard/home', label: 'ホーム', icon: 'home' },
  { href: '/dashboard/reviews', label: '自分の評価', icon: 'reviews' },
  { href: '/dashboard/community', label: 'コミュニティ', icon: 'community' },
  { href: '/dashboard/certified-shops', label: '認定店', icon: 'certified' },
  { href: '/dashboard/colors', label: '色パレット', icon: 'colors' },
  { href: '/dashboard/ai-analysis', label: 'AI分析', icon: 'ai' },
  { href: '/dashboard/card-print', label: '印刷', icon: 'print' },
  { href: '/dashboard/contact', label: '問い合わせ', icon: 'contact' },
]

const iconSrc = (icon: string) => `/icons/nav/${icon}.svg`

const COLLAPSE_KEY = 'teanote_gridnav_collapsed'

export default function GridNav() {
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

  // 前方一致だと /dashboard がすべてに一致してしまうため、原則は完全一致で判定する。
  function isActive(href: string): boolean {
    // AI分析は配下にページが分かれているので前方一致
    if (href === '/dashboard/ai-analysis') return pathname.startsWith(href)
    // 統計(/dashboard)はホームの下位画面なので、そこにいる間もホームを選択中にする（v362）
    if (href === '/dashboard/home') return pathname === '/dashboard/home' || pathname === '/dashboard'
    return pathname === href
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        {collapsed ? (
          /* 折りたたみ時は、開くボタンも同じ1行に入れて縦幅を使わない */
          <div className={styles.rail}>
            <button
              type="button"
              className={styles.railToggle}
              onClick={toggle}
              aria-expanded={false}
              aria-label="メニューを開く">
              ▽
            </button>
            {NAV.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={`${styles.railItem} ${isActive(href) ? styles.railActive : ''}`}>
                <img src={iconSrc(icon)} alt="" className={styles.railIcon}/>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {NAV.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.cell} ${isActive(href) ? styles.cellActive : ''}`}>
                  <img src={iconSrc(icon)} alt="" className={styles.cellIcon}/>
                  <span className={styles.cellLabel}>{label}</span>
                </Link>
              ))}
            </div>
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={toggle}
                aria-expanded={true}
                aria-label="メニューを閉じる">
                <span className={styles.chevron}>▲</span>
                閉じる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
