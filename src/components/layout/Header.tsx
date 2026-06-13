'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import styles from './Header.module.css'

export default function Header({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🍵</span>
        TeaNote
      </div>
      <div className={styles.right}>
        <span className={styles.name}>{profile?.name}</span>
        <div className={styles.avatar} title={profile?.name ?? ''}>
          {profile?.name?.charAt(0) ?? '?'}
        </div>
        <button className={styles.logout} onClick={logout}>ログアウト</button>
      </div>
    </header>
  )
}
