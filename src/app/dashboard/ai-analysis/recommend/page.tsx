'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  generateRecommendation, TeaRecommendation,
  TastePreferences, emptyPreferences, AROMA_LIKE_OPTIONS, buildRecommendationPrompt,
} from '@/lib/aiAdvisor'
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
  const [prefs, setPrefs] = useState<TastePreferences>(emptyPreferences())

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }
    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('reviews')
        .select('tea_name,aroma_notes,score_aroma,score_astringency,score_richness,score_color_depth')
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
      // 本番API接続時は buildRecommendationPrompt の出力をそのままAPIへ渡す。
      // モックの間はコンソールに内容を出力して確認できるようにしておく。
      console.log('[AI API送信予定の内容]\n' + buildRecommendationPrompt(reviews, prefs))
      setResult(generateRecommendation(reviews, prefs))
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
          {/* 診断アンケート: フローチャート式に好みを聞き、AIへ渡す情報を詳細化する */}
          <div className={recStyles.quiz}>
            <p className={recStyles.quizLead}>いくつかの質問に答えると、より好みに合った提案ができます（すべて任意）</p>

            {([
              { key: 'style', label: '☕ 飲み方は？', options: ['ストレート', 'ミルクティー', 'アイスティー'] },
              { key: 'mood', label: '🍃 今の気分は？', options: ['すっきり爽快', 'リラックス・コク深め'] },
              { key: 'sweetAroma', label: '🌸 甘い香りは？', options: ['好き', '苦手'] },
              { key: 'astringency', label: '🍵 渋みの好みは？', options: ['キリッとしっかり', '控えめ・まろやか'] },
              { key: 'body', label: '🫖 コク・味の濃さは？', options: ['濃厚', '軽やか'] },
            ] as const).map(q => (
              <div key={q.key} className={recStyles.quizGroup}>
                <p className={recStyles.quizLabel}>{q.label}</p>
                <div className={recStyles.quizChips}>
                  {q.options.map(o => (
                    <button key={o} type="button"
                      className={`${recStyles.quizChip} ${(prefs as any)[q.key] === o ? recStyles.quizChipOn : ''}`}
                      onClick={() => setPrefs(p => ({ ...p, [q.key]: (p as any)[q.key] === o ? '' : o }))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className={recStyles.quizGroup}>
              <p className={recStyles.quizLabel}>👃 好きな香りの系統は？（複数選択可）</p>
              <div className={recStyles.quizChips}>
                {AROMA_LIKE_OPTIONS.map(o => (
                  <button key={o} type="button"
                    className={`${recStyles.quizChip} ${prefs.aromaLikes.includes(o) ? recStyles.quizChipOn : ''}`}
                    onClick={() => setPrefs(p => ({
                      ...p,
                      aromaLikes: p.aromaLikes.includes(o) ? p.aromaLikes.filter(x => x !== o) : [...p.aromaLikes, o],
                    }))}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className={recStyles.quizGroup}>
              <p className={recStyles.quizLabel}>💬 その他の希望（任意）</p>
              <input className={recStyles.quizInput} type="text" maxLength={100}
                value={prefs.freeText}
                onChange={e => setPrefs(p => ({ ...p, freeText: e.target.value.slice(0, 100) }))}
                placeholder="例: 夜に飲むのでカフェイン控えめだと嬉しい"/>
            </div>
          </div>

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
