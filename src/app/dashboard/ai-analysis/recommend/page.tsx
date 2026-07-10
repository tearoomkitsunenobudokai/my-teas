'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generateRecommendation, TeaRecommendation } from '@/lib/aiAdvisor'
import styles from '../ai-analysis.module.css'
import recStyles from './recommend.module.css'

const RECOMMEND_COST_DEFAULT = 1

export default function RecommendPage() {
  const supabase = createClient()
  const [recommendCost, setRecommendCost] = useState(RECOMMEND_COST_DEFAULT)
  const RECOMMEND_COST = recommendCost
  useEffect(() => {
    supabase.rpc('get_feature_cost', { p_feature: 'recommend' })
      .then(({ data }) => { if (typeof data === 'number') setRecommendCost(data) })
  }, [supabase])
  const [reviews, setReviews] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<TeaRecommendation | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('reviews')
        .select('tea_name,aroma_notes,score_aroma,score_astringency,score_richness,score_sweetness')
        .eq('user_id', user.id),
      supabase.from('profiles').select('is_admin,is_creator,points').eq('id', user.id).single(),
    ])
    setReviews(data ?? [])
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function run() {
    if (!confirm(`${RECOMMEND_COST}ptを消費してオススメを実行します。よろしいですか？`)) return
    setThinking(true)
    setResult(null)

    try {
      // ポイント消費（製作者/管理者はconsume_points内で自動的に消費なし判定される）
      const { data: consumed, error } = await supabase.rpc('consume_points', { p_amount: RECOMMEND_COST, p_feature: 'recommend' })
      const r = consumed?.[0]
      if (error || !r?.success) {
        alert(r?.message ?? error?.message ?? 'ポイントが不足しているため実行できません。')
        setThinking(false)
        return
      }
      setPoints(r.remaining)
    } catch (e: any) {
      alert(`エラーが発生しました: ${e?.message ?? '不明なエラー'}`)
      setThinking(false)
      return
    }

    setTimeout(() => {
      setResult(generateRecommendation(reviews))
      setThinking(false)
    }, 800)
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard/ai-analysis" className={recStyles.back}>← AI分析に戻る</Link>
      <h1 className={styles.title}>☕ オススメの1杯</h1>
      <p className={styles.lead}>
        あなたのこれまでの評価データから、次に飲むのにおすすめの一杯をご提案します。
        <span className={recStyles.mockTag}>※現在はβ版：簡易ロジックによる提案です</span>
      </p>

      {loading ? (
        <p className={recStyles.hint}>読み込み中…</p>
      ) : (
        <>
          <button className={recStyles.runBtn} onClick={run} disabled={thinking}>
            {thinking ? '考え中…' : `☕ おすすめを提案してもらう（${isAdmin ? '消費なし' : `${RECOMMEND_COST}pt`}）`}
          </button>
          {!isAdmin && points !== null && (
            <p className={recStyles.pointsHint}>💎 現在のポイント: {points}pt</p>
          )}

          {thinking && <div className={recStyles.thinking}>あなたの評価データから傾向を分析しています…</div>}

          {result && !thinking && (
            <div className={recStyles.resultCard}>
              <span className={recStyles.resultLabel}>今のあなたにおすすめの一杯</span>
              <p className={recStyles.resultTitle}>{result.title}</p>
              <p className={recStyles.resultReason}>{result.reason}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
