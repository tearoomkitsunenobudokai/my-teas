'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { OMIKUJI_DATA, OMIKUJI_TOTAL, OmikujiEntry } from '@/lib/omikujiData'
import styles from '../../ai-analysis.module.css'
import colStyles from './collection.module.css'

function collectionKey(userId: string) { return `teanote_omikuji_collection_${userId}` }

export default function OmikujiCollectionPage() {
  const supabase = createClient()
  const [collection, setCollection] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<OmikujiEntry | null>(null)

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }
    try {
      const raw = window.localStorage.getItem(collectionKey(user.id))
      setCollection(raw ? JSON.parse(raw) : [])
    } catch { /* noop */ }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const collectedSet = new Set(collection)
  const progress = collection.length

  return (
    <div className={styles.page}>
      <Link href="/dashboard/ai-analysis/fortune" className={colStyles.back}>← 紅茶おみくじに戻る</Link>
      <h1 className={styles.title}>📖 おみくじコレクション</h1>
      <p className={styles.lead}>
        これまでに引いたおみくじの記録です。まだ引いていないものは？で表示されます。
      </p>

      {loading ? (
        <p className={colStyles.hint}>読み込み中…</p>
      ) : (
        <>
          <div className={colStyles.progressCard}>
            <div className={colStyles.progressBarTrack}>
              <div className={colStyles.progressBarFill} style={{ width: `${(progress / OMIKUJI_TOTAL) * 100}%` }} />
            </div>
            <span className={colStyles.progressText}>{progress} / {OMIKUJI_TOTAL} 種 コンプリート</span>
            {progress === OMIKUJI_TOTAL && <span className={colStyles.completeBadge}>🎉 コンプリート達成！</span>}
          </div>

          <div className={colStyles.grid}>
            {OMIKUJI_DATA.map(entry => {
              const got = collectedSet.has(entry.no)
              return (
                <button
                  key={entry.no}
                  type="button"
                  className={`${colStyles.cell} ${got ? colStyles.cellGot : colStyles.cellLocked}`}
                  disabled={!got}
                  onClick={() => got && setSelected(entry)}
                  title={got ? `No.${entry.no} ${entry.fortune}` : '未取得'}
                >
                  <span className={colStyles.cellNo}>{entry.no}</span>
                  {got ? (
                    <span className={colStyles.cellFortune}>{entry.fortune}</span>
                  ) : (
                    <span className={colStyles.cellUnknown}>？</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 取得済みおみくじの詳細モーダル */}
      {selected && (
        <div className={colStyles.overlay} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className={colStyles.detailModal}>
            <button className={colStyles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            <span className={colStyles.detailNo}>No.{selected.no}</span>
            <span className={colStyles.detailFortune}>{selected.fortune}</span>
            <p className={colStyles.detailMessage}>{selected.message}</p>
            <div className={colStyles.detailBlock}>
              <span className={colStyles.detailBlockLabel}>🍵 ラッキー紅茶：{selected.luckyTea}</span>
              <p className={colStyles.detailBlockTrivia}>{selected.teaTrivia}</p>
            </div>
            <div className={colStyles.detailBlock}>
              <span className={colStyles.detailBlockLabel}>🍪 ラッキーおやつ：{selected.luckySnack}</span>
              <p className={colStyles.detailBlockTrivia}>{selected.snackTrivia}</p>
            </div>
            <p className={colStyles.detailLuckyThing}>✨ {selected.luckyThing}</p>
          </div>
        </div>
      )}
    </div>
  )
}
