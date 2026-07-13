'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  generateAdvisorComment, analyzePreference,
  ADVISOR_TIERS, getAdvisorTier, isTierUnlocked, getTierByKey,
  pruneHistory, AdvisorTierKey, AdvisorHistoryEntry,
} from '@/lib/aiAdvisor'
import styles from '../ai-analysis.module.css'
import advisorStyles from './advisor.module.css'

function historyKey(userId: string) { return `teanote_advisor_history_${userId}` }

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AdvisorPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [advisorCost, setAdvisorCost] = useState(2)
  const [selectedKey, setSelectedKey] = useState<AdvisorTierKey | null>(null)
  const [history, setHistory] = useState<AdvisorHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('reviews')
        .select('tea_name,shop_name,aroma_notes,score_aroma,score_astringency,score_richness,score_sweetness')
        .eq('user_id', user.id),
      supabase.from('profiles').select('is_admin,is_creator,points').eq('id', user.id).single(),
    ])
    setReviews(data ?? [])
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)

    // 直近1週間の分析履歴をローカルから復元（端末内保存・βのためサーバー保存はしていません）
    try {
      const raw = window.localStorage.getItem(historyKey(user.id))
      const parsed: AdvisorHistoryEntry[] = raw ? JSON.parse(raw) : []
      const pruned = pruneHistory(parsed)
      setHistory(pruned)
      if (pruned.length !== parsed.length) {
        window.localStorage.setItem(historyKey(user.id), JSON.stringify(pruned))
      }
    } catch { /* localStorageが使えない環境では履歴機能を無効化するだけにする */ }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // データ読み込み完了時、解放されている最上位キャラクターを初期選択にする（管理者は常に全解放）
  useEffect(() => {
    if (loading) return
    if (isAdmin) { setSelectedKey('veteran'); return }
    setSelectedKey(reviews.length > 0 ? getAdvisorTier(reviews.length).key : null)
  }, [loading, isAdmin, reviews.length])

  const tier = selectedKey ? ADVISOR_TIERS.find(t => t.key === selectedKey)! : null

  const ADVISOR_COST = advisorCost

  useEffect(() => {
    supabase.rpc('get_feature_cost', { p_feature: 'advisor' })
      .then(({ data }) => { if (typeof data === 'number') setAdvisorCost(data) })
  }, [supabase])

  async function runAnalysis() {
    if (!tier) return
    if (!confirm(`${ADVISOR_COST}ptを消費してAIアドバイザーを実行します。よろしいですか？`)) return
    setAnalyzing(true)
    setShowHistory(false)

    try {
      // ポイント消費（製作者/管理者はconsume_points内で自動的に消費なし判定される）
      const { data: consumed, error } = await supabase.rpc('consume_points', { p_amount: ADVISOR_COST, p_feature: 'advisor' })
      const result = consumed?.[0]
      if (error || !result?.success) {
        alert(result?.message ?? error?.message ?? 'ポイントが不足しているため実行できません。')
        setAnalyzing(false)
        return
      }
      setPoints(result.remaining)
    } catch (e: any) {
      alert(`エラーが発生しました: ${e?.message ?? '不明なエラー'}`)
      setAnalyzing(false)
      return
    }

    // 実際のAI API呼び出しを想定し、わざと少し待ってから結果を表示（UXのプロトタイプ確認用）
    setTimeout(() => {
      const entry: AdvisorHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tierKey: tier.key,
        comment: generateAdvisorComment(reviews, tier.key),
        createdAt: new Date().toISOString(),
      }
      setHistory(prev => {
        const next = pruneHistory([entry, ...prev])
        try { window.localStorage.setItem(historyKey(userId), JSON.stringify(next)) } catch {}
        return next
      })
      setAnalyzing(false)
    }, 900)
  }

  const stats = analyzePreference(reviews)
  const latest = history[0]
  const past = history.slice(1)

  return (
    <div className={styles.page}>
      <Link href="/dashboard/ai-analysis" className={advisorStyles.back}>← AI分析に戻る</Link>
      <h1 className={styles.title}>🧑‍🔬 AIティーアドバイザーに聞く</h1>
      <p className={styles.lead}>
        あなたがこれまで登録した評価データをもとに、お茶の好みを分析します。評価件数に応じてキャラクターが解放され、解放済みのキャラクターから選んで聞くことができます。
        <span className={advisorStyles.mockTag}>※現在はβ版：簡易ロジックによる分析です</span>
        {isAdmin && <span className={advisorStyles.adminTag}>🔑 管理者：全キャラクター解放中</span>}
      </p>

      {!loading && reviews.length > 0 && (
        <div className={advisorStyles.statRow}>
          <div className={advisorStyles.statBox}>
            <span className={advisorStyles.statNum}>{stats.count}</span>
            <span className={advisorStyles.statLabel}>評価件数</span>
          </div>
          <div className={advisorStyles.statBox}>
            <span className={advisorStyles.statNum}>{stats.topAroma ?? '―'}</span>
            <span className={advisorStyles.statLabel}>よく選ぶ香り</span>
          </div>
          <div className={advisorStyles.statBox}>
            <span className={advisorStyles.statNum}>{stats.topTea ?? '―'}</span>
            <span className={advisorStyles.statLabel}>よく飲む紅茶</span>
          </div>
        </div>
      )}

      {/* キャラクター選択（解放されていないキャラクターはグレーアウトして選択不可） + 履歴ボタン */}
      <div className={advisorStyles.tierTrack}>
        {ADVISOR_TIERS.map(t => {
          const unlocked = !loading && (isAdmin || isTierUnlocked(t, reviews.length))
          const active = selectedKey === t.key
          return (
            <button
              key={t.key}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && setSelectedKey(t.key)}
              className={[
                advisorStyles.tierStep,
                active ? advisorStyles.tierStepActive : '',
                !unlocked ? advisorStyles.tierStepLocked : '',
              ].join(' ')}
            >
              <span className={advisorStyles.tierStepEmoji}>{unlocked ? t.emoji : '🔒'}</span>
              <span className={advisorStyles.tierStepText}>
                <span className={advisorStyles.tierStepName}>{t.levelLabel}</span>
                <span className={advisorStyles.tierStepRange}>{t.rangeLabel}</span>
              </span>
            </button>
          )
        })}

        {/* リザ（ベテラン）の隣に履歴ボタンを配置 */}
        <button
          type="button"
          disabled={history.length === 0}
          onClick={() => setShowHistory(v => !v)}
          className={[advisorStyles.historyBtn, history.length === 0 ? advisorStyles.tierStepLocked : ''].join(' ')}
        >
          <span className={advisorStyles.tierStepEmoji}>📜</span>
          <span className={advisorStyles.tierStepText}>
            <span className={advisorStyles.tierStepName}>履歴</span>
            <span className={advisorStyles.tierStepRange}>
              {history.length > 0 ? `直近1週間・${history.length}件` : '記録なし'}
            </span>
          </span>
        </button>
      </div>

      {!loading && reviews.length === 0 && !isAdmin && (
        <div className={styles.note}>
          まだ評価が登録されていません。「自分の評価」からお茶の評価を登録すると、見習いAIティーアドバイザーから解放されます。
        </div>
      )}
      {!loading && reviews.length === 0 && isAdmin && (
        <div className={styles.note}>
          🔑 管理者権限により、評価が0件でも全キャラクターを選択できます（分析対象データがないため、コメントは空データ用の案内文になります）。
        </div>
      )}

      {!loading && (reviews.length > 0 || isAdmin) && tier && (
        <button className={advisorStyles.runBtn} onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? '分析中…' : `${tier.emoji} ${tier.name}に聞く（${isAdmin ? '消費なし' : `${ADVISOR_COST}pt`}）`}
        </button>
      )}
      {!loading && !isAdmin && points !== null && (
        <p className={advisorStyles.pointsHint}>💎 現在のポイント: {points}pt</p>
      )}

      {/* 分析中の演出（選択中のキャラクターで表示） */}
      {analyzing && tier && (
        <div className={advisorStyles.speechRow}>
          <div className={`${advisorStyles.avatar} ${advisorStyles.avatarTalking}`}>
            <span className={advisorStyles.avatarEmoji}>{tier.emoji}</span>
            <span className={advisorStyles.avatarTag}>{tier.levelLabel}</span>
          </div>
          <div className={advisorStyles.bubble}>
            <span className={advisorStyles.bubbleName}>{tier.name}</span>
            <p className={advisorStyles.bubbleTyping}>
              あなたの評価データを分析しています<span className={advisorStyles.dots}>...</span>
            </p>
          </div>
        </div>
      )}

      {/* 最新の結果：聞いた時点のキャラクターのまま、上書きされずに表示され続ける */}
      {!analyzing && latest && (
        <HistoryBubble entry={latest} />
      )}

      {/* 履歴パネル：直近1週間ぶん。各回が聞いた時点のキャラクター・コメントのまま保持される */}
      {showHistory && (
        <div className={advisorStyles.historyPanel}>
          <p className={advisorStyles.historyPanelTitle}>📜 過去1週間の履歴</p>
          {past.length === 0 ? (
            <p className={advisorStyles.hint}>これより古い履歴はまだありません。</p>
          ) : (
            <div className={advisorStyles.historyList}>
              {past.map(entry => <HistoryBubble key={entry.id} entry={entry} compact />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryBubble({ entry, compact }: { entry: AdvisorHistoryEntry; compact?: boolean }) {
  const t = getTierByKey(entry.tierKey)
  return (
    <div className={`${advisorStyles.speechRow} ${compact ? advisorStyles.speechRowCompact : ''}`}>
      <div className={advisorStyles.avatar}>
        <span className={advisorStyles.avatarEmoji}>{t.emoji}</span>
        <span className={advisorStyles.avatarTag}>{t.levelLabel}</span>
      </div>
      <div className={advisorStyles.bubble}>
        <div className={advisorStyles.bubbleHead}>
          <span className={advisorStyles.bubbleName}>{t.name}</span>
          <span className={advisorStyles.bubbleTime}>{fmtTime(entry.createdAt)}</span>
        </div>
        <p className={advisorStyles.bubbleText}>{entry.comment}</p>
      </div>
    </div>
  )
}
