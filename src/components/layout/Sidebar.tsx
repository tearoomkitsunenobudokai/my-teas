'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

const NAV = [
  { href: '/dashboard/home', label: 'ホーム', icon: '🏠' },
  { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/dashboard/reviews', label: '自分の評価', icon: '⭐' },
  { href: '/dashboard/community', label: 'コミュニティ', icon: '👥' },
  { href: '/dashboard/certified-shops', label: '認定店', icon: '🏅' },
  { href: '/dashboard/colors', label: 'カラーパレット', icon: '🎨' },
  { href: '/dashboard/ai-analysis', label: 'AI分析', icon: '🤖' },
  { href: '/dashboard/card-print', label: '印刷用に変換', icon: '🖨' },
  { href: '/dashboard/contact', label: 'お問い合わせ', icon: '✉️' },
]

const COLLAPSE_KEY = 'teanote_sidebar_collapsed'

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // 前回の開閉状態を復元
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  // スマホ表示のときだけ、ナビで画面遷移したら自動でメニューを最小化する。
  // （展開したままだと本文が狭くなるため。PCでは従来通り維持する）
  function handleNavClick(href: string) {
    if (href === pathname) return // 同じ画面なら何もしない
    if (typeof window === 'undefined') return
    const isMobile = window.matchMedia(
      '(max-width: 768px), (pointer: coarse) and (max-width: 1100px)'
    ).matches
    if (isMobile) {
      setCollapsed(true)
      localStorage.setItem(COLLAPSE_KEY, '1')
    }
  }

  return (
    <nav className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'メニューを展開' : 'メニューを最小化'}
        title={collapsed ? '展開' : '最小化'}>
        {collapsed ? '»' : '«'}
      </button>

      {!collapsed && <div className={styles.section}>メニュー</div>}
      {NAV.map(({ href, label, icon }) => (
        <Link key={href} href={href}
          onClick={() => handleNavClick(href)}
          title={collapsed ? label : undefined}
          className={`${styles.item} ${pathname === href ? styles.active : ''}`}>
          <span>{icon}</span> {!collapsed && label}
        </Link>
      ))}
      {isAdmin && (
        <>
          {!collapsed && <div className={styles.section}>管理</div>}
          <Link href="/dashboard/admin"
            onClick={() => handleNavClick('/dashboard/admin')}
            title={collapsed ? '管理者メニュー' : undefined}
            className={`${styles.item} ${pathname === '/dashboard/admin' ? styles.active : ''}`}>
            <span>⚙️</span> {!collapsed && '管理者メニュー'}
          </Link>
        </>
      )}
    </nav>
  )
}
