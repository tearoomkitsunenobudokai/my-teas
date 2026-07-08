import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import LoginBonus from '@/components/LoginBonus'
import styles from './app-layout.module.css'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className={styles.app}>
      <LoginBonus />
      <Header profile={profile} />
      <div className={styles.body}>
        {/* 製作者(is_creator)も管理者メニューが見えるようにする */}
        <Sidebar isAdmin={(profile?.is_admin || profile?.is_creator) ?? false} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
