import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { CATEGORY_LABELS } from '@/types'
import DeleteTeaButton from './DeleteTeaButton'
import styles from './admin.module.css'

export default async function AdminPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  const { data: teas } = await supabase.from('teas').select('*, profiles(name)').order('is_official', { ascending: false }).order('created_at')
  const { data: allReviews } = await supabase.from('reviews').select('id', { count: 'exact' })
  const { data: users } = await supabase.from('profiles').select('id, name, is_admin, created_at').order('created_at')

  return (
    <div>
      <h1 className={styles.title}>管理者メニュー</h1>
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.sl}>ユーザー数</div><div className={styles.sv}>{users?.length ?? 0}</div></div>
        <div className={styles.stat}><div className={styles.sl}>茶葉数</div><div className={styles.sv}>{teas?.length ?? 0}</div></div>
        <div className={styles.stat}><div className={styles.sl}>評価数</div><div className={styles.sv}>{allReviews?.length ?? 0}</div></div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>茶葉マスタ</h2>
        <table className={styles.table}>
          <thead><tr><th>名前</th><th>カテゴリ</th><th>登録者</th><th>種別</th><th></th></tr></thead>
          <tbody>
            {teas?.map((t: any) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS]}</td>
                <td>{t.profiles?.name ?? 'システム'}</td>
                <td>{t.is_official ? <span className={styles.official}>公式</span> : <span className={styles.user}>ユーザー</span>}</td>
                <td><DeleteTeaButton teaId={t.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.section} style={{ marginTop: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>ユーザー一覧</h2>
        <table className={styles.table}>
          <thead><tr><th>名前</th><th>管理者</th><th>登録日</th></tr></thead>
          <tbody>
            {users?.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.is_admin ? '✅' : '—'}</td>
                <td>{new Date(u.created_at).toLocaleDateString('ja-JP')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
