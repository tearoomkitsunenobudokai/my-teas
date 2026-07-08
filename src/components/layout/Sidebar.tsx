'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード', icon: '🏠' },
  { href: '/dashboard/reviews', label: '自分の評価', icon: '⭐' },
  { href: '/dashboard/community', label: 'コミュニティ', icon: '👥' },
  { href: '/dashboard/certified-shops', label: '認定店', icon: '🏅' },
  { href: '/dashboard/colors', label: 'カラーパレット', icon: '🎨' },
  { href: '/dashboard/ai-analysis', label: 'AI分析', icon: '🤖' },
  { href: '/dashboard/contact', label: 'お問い合わせ', icon: '✉️' },
]

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  return (
    <nav className={styles.sidebar}>
      <div className={styles.section}>メニュー</div>
      {NAV.map(({ href, label, icon }) => (
        <Link key={href} href={href}
          className={`${styles.item} ${pathname === href ? styles.active : ''}`}>
          <span>{icon}</span> {label}
        </Link>
      ))}
      {isAdmin && (
        <>
          <div className={styles.section}>管理</div>
          <Link href="/dashboard/admin"
            className={`${styles.item} ${pathname === '/dashboard/admin' ? styles.active : ''}`}>
            <span>⚙️</span> 管理者メニュー
          </Link>
        </>
      )}
    </nav>
  )
}
