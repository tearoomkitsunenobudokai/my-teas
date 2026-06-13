import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SCORE_LABELS, ReviewScores } from '@/types'
import Link from 'next/link'
import styles from '../reviews/reviews.module.css'

export default async function CommunityPage() {
  const supabase = createServerSupabaseClient()
  const { data: reviews } = await supabase
    .from('reviews').select('*, teas(name, category), profiles(name)')
    .eq('is_public', true).order('created_at', { ascending: false })

  const scoreKeys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  const avg = (r: any) => (scoreKeys.reduce((s, k) => s + r[k], 0) / scoreKeys.length).toFixed(1)

  return (
    <div>
      <h1 className={styles.title}>コミュニティの評価</h1>
      {!reviews?.length ? (
        <div className={styles.empty}><p>まだ公開評価はありません</p></div>
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
                <span className={styles.date}>{r.profiles?.name} · {new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
