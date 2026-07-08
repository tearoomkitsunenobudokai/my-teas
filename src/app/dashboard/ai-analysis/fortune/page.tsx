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
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [result, setResult] = useState<OmikujiEntry | null>(null)
  const [collection, setCollection] = useState<number[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    // コレクション状況をローカルから復元
    // （端末内保存・βのためサーバー保存はしていません）
    try {
      const rawC = window.localStorage.getItem(collectionKey(user.id))
      setCollection(rawC ? JSON.parse(rawC) : [])
    } catch { /* noop */ }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function draw() {
    setRevealing(true)
    setTimeout(() => {
      const drawn = generateFortune()
      setResult(drawn)
      setCollection(prev => {
        const next = addToCollection(prev, drawn.no)
        try { window.localStorage.setItem(collectionKey(userId), JSON.stringify(next)) } catch {}
        return next
      })
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
