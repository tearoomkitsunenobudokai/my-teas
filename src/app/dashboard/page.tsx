import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Review, SCORE_LABELS, ReviewScores } from '@/types'
import Link from 'next/link'
import styles from './dashboard.module.css'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: myReviews }, { count: teaCount }, { count: communityCount }] = await Promise.all([
    supabase.from('reviews').select('*, teas(name, category)').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('teas').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('is_public', true),
  ])

  const avgScore = (r: Review) => {
    const keys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
    return (keys.reduce((sum, k) => sum + r[k], 0) / keys.length).toFixed(1)
  }

  return (
    <div>
      <h1 className={styles.title}>ダッシュボード</h1>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>自分の評価数</div>
          <div className={styles.statVal}>{myReviews?.length ?? 0}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>登録茶葉数</div>
          <div className={styles.statVal}>{teaCount ?? 0}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>公開評価総数</div>
          <div className={styles.statVal}>{communityCount ?? 0}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>最近の評価</h2>
          <Link href="/dashboard/reviews" className={styles.link}>すべて見る →</Link>
        </div>
        {!myReviews?.length ? (
          <div className={styles.empty}>
            <p>まだ評価がありません</p>
            <Link href="/dashboard/teas" className={styles.btnGreen}>お茶を評価する</Link>
          </div>
        ) : (
          <div className={styles.reviewList}>
            {myReviews.map((r: Review) => (
              <Link href={`/dashboard/reviews/${r.id}`} key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewName}>{r.teas?.name ?? '不明'}</div>
                <div className={styles.reviewMeta}>平均スコア: {avgScore(r)} / 10</div>
                {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
                <div className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
