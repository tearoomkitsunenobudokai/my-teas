import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Header from '@/components/layout/Header'
import GridNav from '@/components/layout/GridNav'
import SubNav from '@/components/layout/SubNav'
import LoginBonus from '@/components/LoginBonus'
import styles from './app-layout.module.css'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [{ data: profile }, { data: mode }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.rpc('get_maintenance_mode'),
  ])

  const isPrivileged = (profile?.is_admin || profile?.is_creator) ?? false

  // 全面停止中は、製作者・管理者以外をメンテナンス画面へ送る（その画面でログアウトさせる）
  if (mode === 'full' && !isPrivileged) redirect('/maintenance')

  return (
    <div className={styles.app}>
      <LoginBonus />
      <Header profile={profile} isAdmin={isPrivileged} />
      {mode === 'readonly' && (
        <div className={styles.maintenanceBar}>
          🔧 ただいまメンテナンス中です。閲覧のみ可能で、評価の登録・編集はできません。
        </div>
      )}
      {mode === 'full' && isPrivileged && (
        <div className={styles.maintenanceBar}>
          🔧 メンテナンス（全面停止）中です。一般ユーザーはアクセスできません。
        </div>
      )}
      {/* 上部にメニューを置き、本文は下に広く取る（v357）
          管理者メニューはヘッダーの歯車に移したため、グリッドは常に8個で固定（v362）*/}
      <GridNav />
      {/* ホーム／統計のように下位画面を持つグループでのみ、第2階層のタブを出す */}
      <SubNav />
      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.mainInner}>{children}</div>
        </main>
      </div>
    </div>
  )
}
