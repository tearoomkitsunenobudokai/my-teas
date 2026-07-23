'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generateFortune, addToCollection } from '@/lib/aiAdvisor'
import { OMIKUJI_TOTAL, OmikujiEntry } from '@/lib/omikujiData'
import styles from '../ai-analysis.module.css'
import fortuneStyles from './fortune.module.css'

function collectionKey(userId: string) { return `teanote_omikuji_collection_${userId}` }

function ResultCard({ entry }: { entry: OmikujiEntry }) {
  return (
    <div className={fortuneStyles.resultCard}>
      <span className={fortuneStyles.resultNo}>No.{entry.no}</span>
      <span className={fortuneStyles.fortune}>{entry.fortune}</span>
      <p className={fortuneStyles.message}>{entry.message}</p>

      <div className={fortuneStyles.block}>
        <span className={fortuneStyles.blockLabel}>🍵 ラッキー紅茶：{entry.luckyTea}</span>
        <p className={fortuneStyles.blockTrivia}>{entry.teaTrivia}</p>
      </div>
      <div className={fortuneStyles.block}>
        <span className={fortuneStyles.blockLabel}>🍪 ラッキーおやつ：{entry.luckySnack}</span>
        <p className={fortuneStyles.blockTrivia}>{entry.snackTrivia}</p>
      </div>
      <div className={fortuneStyles.block}>
        <span className={fortuneStyles.blockLabel}>🌱 今日の小さな幸せのタネ</span>
        <p className={fortuneStyles.blockTrivia}>{entry.luckyThing}</p>
      </div>
    </div>
  )
}

export default function FortunePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [result, setResult] = useState<OmikujiEntry | null>(null)
  const [collection, setCollection] = useState<number[]>([])

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }

    // 旧バージョンで端末内(localStorage)に保存されていたコレクションがあれば、
    // 一度だけサーバーへ引き継いでから削除する（機種変更・キャッシュ削除での消失を防ぐ）
    try {
      const legacy = window.localStorage.getItem(collectionKey(user.id))
      if (legacy) {
        const nums: number[] = JSON.parse(legacy)
        if (Array.isArray(nums) && nums.length > 0) {
          await supabase.rpc('merge_omikuji_collection', { p_numbers: nums })
        }
        window.localStorage.removeItem(collectionKey(user.id))
      }
    } catch { /* 移行に失敗しても以降のDB取得は続行する */ }

    // コレクションをサーバーから取得
    const { data } = await supabase
      .from('omikuji_draws')
      .select('omikuji_no')
      .eq('user_id', user.id)
    setCollection((data ?? []).map(r => r.omikuji_no))

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function draw() {
    setRevealing(true)
    setTimeout(async () => {
      const drawn = generateFortune()
      setResult(drawn)
      setCollection(prev => addToCollection(prev, drawn.no))
      // サーバーに記録（失敗しても画面表示は継続する）
      try {
        await supabase.rpc('record_omikuji_draw', { p_omikuji_no: drawn.no })
      } catch { /* noop */ }
      setRevealing(false)
    }, 800)
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard/ai-analysis" className={fortuneStyles.back}>← AI分析に戻る</Link>
      <h1 className={styles.title}>🔮 紅茶おみくじ</h1>
      <p className={styles.lead}>
        今日のあなたにおすすめの一杯を占います。全{OMIKUJI_TOTAL}種類、コンプリートを目指してみてください。
        <span className={fortuneStyles.mockTag}>無料</span>
      </p>

      {loading ? (
        <p className={fortuneStyles.hint}>読み込み中…</p>
      ) : (
        <>
          <div className={fortuneStyles.btnRow}>
            <button className={fortuneStyles.drawBtn} onClick={draw} disabled={revealing}>
              {revealing ? 'おみくじ中…' : '🔮 今日のおみくじを引く'}
            </button>
            <Link href="/dashboard/ai-analysis/fortune/collection" className={fortuneStyles.collectionLink}>
              📖 コレクション（{collection.length}/{OMIKUJI_TOTAL}）
            </Link>
          </div>

          {revealing && <div className={fortuneStyles.thinking}>茶葉におみくじを尋ねています…</div>}

          {!revealing && result && <ResultCard entry={result} />}
        </>
      )}
    </div>
  )
}
