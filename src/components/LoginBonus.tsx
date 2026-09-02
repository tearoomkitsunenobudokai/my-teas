'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import styles from './LoginBonus.module.css'

// アプリ（ダッシュボード）を開いたときに1回だけログインを記録し、
// スタンプが押された様子を画面で見せる。
// 付与判定・重複防止はサーバー側(record_login_and_grant_v2)で行う。
//
// 「勝手にたまっていて実感がない」という声を受け、
// ・今日スタンプが押されたときだけ表示する（2回目以降の表示では出さない）
// ・押されたマスがあとから飛び込んでくるアニメーションを付ける
// ・達成した回はポイント獲得も同じ画面で見せる
// という作りにしている。

type Result = {
  stamped: boolean
  granted: number
  count: number
  need: number
  bonus: number
}

export default function LoginBonus() {
  const [result, setResult] = useState<Result | null>(null)
  // 押される前の状態から描き始め、少し遅らせて最後の1つを押す
  const [pressed, setPressed] = useState(false)
  const [closing, setClosing] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return   // Strict Mode等での二重実行を防ぐ
    ran.current = true
    const supabase = createClient()
    supabase.rpc('record_login_and_grant_v2').then(({ data, error }) => {
      if (error || !data) return
      const r = data as Result
      if (!r.stamped) return   // 今日はもう押してある。何も出さない。
      setResult(r)
      // 少し待ってから押す。開いた瞬間に完了していると印象に残らないため。
      setTimeout(() => setPressed(true), 450)
    })
  }, [])

  function close() {
    setClosing(true)
    setTimeout(() => setResult(null), 200)
  }

  if (!result) return null

  const { granted, count, need, bonus } = result
  // count は「押した後」の個数。押す前は1つ少ない。
  const filledNow = pressed ? count : count - 1
  const remaining = Math.max(0, need - count)
  const achieved = granted > 0

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onClick={close}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={close} aria-label="閉じる">✕</button>

        <p className={styles.eyebrow}>ログインスタンプ</p>
        <h2 className={styles.title}>
          {pressed ? 'スタンプを押しました！' : 'スタンプを押しています…'}
        </h2>

        <div className={styles.grid}>
          {Array.from({ length: need }).map((_, i) => {
            const filled = i < filledNow
            // 今回押されたのは最後の1つ
            const isNew = pressed && i === count - 1
            const isGoal = i === need - 1
            return (
              <div key={i}
                className={[
                  styles.box,
                  filled ? styles.boxFilled : '',
                  isNew ? styles.boxNew : '',
                  isGoal && !filled ? styles.boxGoal : '',
                ].filter(Boolean).join(' ')}>
                {filled ? '🍵' : (isGoal ? `+${bonus}pt` : i + 1)}
              </div>
            )
          })}
        </div>

        {achieved ? (
          <div className={styles.bonusBox}>
            <p className={styles.bonusTitle}>🎉 {need}個たまりました</p>
            <p className={styles.bonusText}>
              <strong>{granted}ポイント</strong>を獲得しました
            </p>
            <p className={styles.bonusNote}>カードは新しいものに変わります</p>
          </div>
        ) : (
          <p className={styles.progress}>
            あと <strong>{remaining}</strong> 個で {bonus}ポイント
          </p>
        )}

        <button className={styles.okBtn} onClick={close}>OK</button>
      </div>
    </div>
  )
}
