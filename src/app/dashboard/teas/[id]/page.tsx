import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CATEGORY_LABELS, SCORE_LABELS, ReviewScores } from '@/types'
import { notFound } from 'next/navigation'
import ReviewForm from './ReviewForm'
import styles from './tea-detail.module.css'

export default async function TeaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tea }, { data: myReview }, { data: publicReviews }] = await Promise.all([
    supabase.from('teas').select('*').eq('id', params.id).single(),
    supabase.from('reviews').select('*').eq('tea_id', params.id).eq('user_id', user!.id).maybeSingle(),
    supabase.from('reviews').select('*, profiles(name)').eq('tea_id', params.id).eq('is_public', true).order('created_at', { ascending: false }),
  ])

  if (!tea) notFound()

  const scoreKeys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  const avgOf = (r: any) => (scoreKeys.reduce((s, k) => s + r[k], 0) / scoreKeys.length).toFixed(1)

  return (
    <div>
      <div className={styles.teaHeader}>
        <div>
          <h1 className={styles.teaName}>{tea.name}</h1>
          <p className={styles.teaMeta}>{tea.origin} · {CATEGORY_LABELS[tea.category as keyof typeof CATEGORY_LABELS]}</p>
          {tea.description && <p className={styles.teaDesc}>{tea.description}</p>}
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <h2 className={styles.sectionTitle}>あなたの評価</h2>
          <ReviewForm teaId={tea.id} teaName={tea.name} existingReview={myReview} userId={user!.id} />
        </div>
        <div>
          <h2 className={styles.sectionTitle}>コミュニティの評価 ({publicReviews?.length ?? 0}件)</h2>
          {!publicReviews?.length ? (
            <p className={styles.empty}>まだ公開評価はありません</p>
          ) : (
            publicReviews.map((r: any) => (
              <div key={r.id} className={styles.pubReview}>
                <div className={styles.pubHeader}>
                  <span className={styles.pubName}>{r.profiles?.name}</span>
                  <span className={styles.pubScore}>平均 {avgOf(r)}</span>
                </div>
                <div className={styles.scores}>
                  {scoreKeys.map(k => (
                    <div key={k} className={styles.scoreItem}>
                      <span>{SCORE_LABELS[k]}</span>
                      <strong>{r[k]}</strong>
                    </div>
                  ))}
                </div>
                {r.comment && <p className={styles.pubComment}>"{r.comment}"</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
