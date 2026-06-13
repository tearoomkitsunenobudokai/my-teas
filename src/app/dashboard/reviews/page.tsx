import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SCORE_LABELS, ReviewScores } from '@/types'
import Link from 'next/link'
import styles from './reviews.module.css'

export default async function ReviewsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: reviews } = await supabase
    .from('reviews').select('*, teas(name, category)')
    .eq('user_id', user!.id).order('created_at', { ascending: false })

  const scoreKeys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  const avg = (r: any) => (scoreKeys.reduce((s, k) => s + r[k], 0) / scoreKeys.length).toFixed(1)

  return (
    <div>
      <h1 className={styles.title}>自分の評価</h1>
      {!reviews?.length ? (
        <div className={styles.empty}>
          <p>まだ評価がありません</p>
          <Link href="/dashboard/teas" className={styles.btn}>お茶一覧へ</Link>
        </div>
      ) : (
        <div className={styles.list}>
          {reviews.map((r: any) => (
            <Link href={`/dashboard/teas/${r.tea_id}`} key={r.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.teaName}>{r.teas?.name}</span>
                <span className={styles.avg}>平均 {avg(r)} / 10</span>
              </div>
              <div className={styles.pills}>
                {scoreKeys.map(k => (
                  <span key={k} className={styles.pill}>{SCORE_LABELS[k]}: {r[k]}</span>
                ))}
              </div>
              {r.comment && <p className={styles.comment}>{r.comment}</p>}
              <div className={styles.footer}>
                <span className={styles.date}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                <span className={r.is_public ? styles.public : styles.private}>{r.is_public ? '🌍 公開' : '🔒 非公開'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
