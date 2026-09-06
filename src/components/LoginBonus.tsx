'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import StampCardView from './StampCardView'
import styles from './LoginBonus.module.css'

// アプリ（ダッシュボード）を開いたときに1回だけログインを記録し、
// スタンプが押された様子を画面で見せる。
// 付与判定・重複防止はサーバー側(record_login_and_grant_v4)で行う。
//
// 「勝手にたまっていて実感がない」という声を受け、
// ・今日スタンプが押されたときだけ表示する（2回目以降の表示では出さない）
// ・押されたマスがあとから飛び込んでくるアニメーションを付ける
// ・達成した回はポイント獲得も同じ画面で見せる
// という作りにしている。
//
// カードの見た目は StampCardView に切り出してある。
// ポイント画面の確認用の表示と同じ部品を使い、見た目がずれないようにするため。

type Result = {
  stamped: boolean
  granted: number
  hand: string
  handPoints: number
  count: number
  need: number
  bonus: number
  icons: string[]      // 引いた絵柄を古い順に
  pool: string[]       // このカードで使う絵柄の候補
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
    supabase.rpc('record_login_and_grant_v4').then(({ data, error }) => {
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

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onClick={close}>
      <StampCardView
        count={result.count}
        need={result.need}
        bonus={result.bonus}
        icons={result.icons}
        poolSize={result.pool?.length ?? 0}
        granted={result.granted}
        hand={result.hand}
        handPoints={result.handPoints}
        pressed={pressed}
        onClose={close}
      />
    </div>
  )
}
