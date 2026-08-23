'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './SubNav.module.css'

/*
 * グリッドメニューの下に出す、第2階層のタブ（v362）
 *
 * ホーム系の画面は「ホーム」と「統計」に分かれているが、
 * グリッドの枠は8個で固定したいため、片方だけをグリッドに出し、
 * もう片方へはこのタブから移動できるようにする。
 *
 * 無関係な画面にまでタブが出ると邪魔なので、
 * 対象の画面にいるときだけ表示する。
 */

type Tab = { href: string; label: string }

/* 「どの画面グループにいるとき、どのタブを出すか」の対応表。
   将来ほかのグループを足すときは、ここに追加する。 */
const GROUPS: { paths: string[]; tabs: Tab[] }[] = [
  {
    paths: ['/dashboard/home', '/dashboard'],
    tabs: [
      { href: '/dashboard/home', label: 'ホーム' },
      { href: '/dashboard', label: '統計' },
    ],
  },
]

export default function SubNav() {
  const pathname = usePathname()

  // 完全一致で判定する。前方一致だと /dashboard がすべての配下に反応してしまう。
  const group = GROUPS.find(g => g.paths.includes(pathname))
  if (!group) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        {group.tabs.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${pathname === href ? styles.tabActive : ''}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
