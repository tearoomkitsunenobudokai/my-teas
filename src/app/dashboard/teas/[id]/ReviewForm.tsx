'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SCORE_LABELS, ReviewScores } from '@/types'
import dynamic from 'next/dynamic'
import styles from './ReviewForm.module.css'

const RadarChart = dynamic(() => import('@/components/charts/RadarChart'), { ssr: false })

const INIT_SCORES: ReviewScores = {
  score_aroma: 5, score_taste: 5, score_color: 5,
  score_astringency: 5, score_sweetness: 5, score_aftertaste: 5,
}

interface Props { teaId: string; teaName: string; existingReview: any; userId: string }

export default function ReviewForm({ teaId, teaName, existingReview, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [scores, setScores] = useState<ReviewScores>(existingReview ? {
    score_aroma: existingReview.score_aroma,
    score_taste: existingReview.score_taste,
    score_color: existingReview.score_color,
    score_astringency: existingReview.score_astringency,
    score_sweetness: existingReview.score_sweetness,
    score_aftertaste: existingReview.score_aftertaste,
  } : INIT_SCORES)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [isPublic, setIsPublic] = useState(existingReview?.is_public ?? false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const setScore = (k: keyof ReviewScores, v: number) => setScores(s => ({ ...s, [k]: v }))

  async function save() {
    setLoading(true)
    const payload = { ...scores, comment, is_public: isPublic, tea_id: teaId, user_id: userId }
    if (existingReview) {
      await supabase.from('reviews').update(payload).eq('id', existingReview.id)
    } else {
      await supabase.from('reviews').insert(payload)
    }
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chartWrap}>
        <RadarChart scores={scores} label={teaName} size={280} />
      </div>
      <div className={styles.sliders}>
        {(Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]).map(k => (
          <div key={k} className={styles.sliderRow}>
            <span className={styles.sliderLabel}>{SCORE_LABELS[k]}</span>
            <input type="range" min={1} max={10} step={1} value={scores[k]}
              onChange={e => setScore(k, +e.target.value)} className={styles.slider} />
            <span className={styles.sliderVal}>{scores[k]}</span>
          </div>
        ))}
      </div>
      <textarea className={styles.textarea} value={comment} onChange={e => setComment(e.target.value)}
        placeholder="飲んだ感想を書いてください…" rows={3} />
      <label className={styles.checkLabel}>
        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
        コミュニティに公開する
      </label>
      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {saved ? '✓ 保存しました！' : loading ? '保存中...' : existingReview ? '評価を更新' : '評価を保存'}
      </button>
    </div>
  )
}
