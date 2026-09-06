'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { stampIcon, handInfo, possibleHands, HANDS, HAND_ORDER } from '@/lib/stampIcons'
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

  const { granted, count, need, bonus, hand, handPoints, icons } = result
  const info = handInfo(hand)
  const hasHand = info.level > 0
  // count は「押した後」の個数。押す前は1つ少ない。
  const filledNow = pressed ? count : count - 1
  const remaining = Math.max(0, need - count)
  const achieved = granted > 0

  // まだ成立しうる役。マスが5つのときだけ6役がそろうので、
  // 設定が変わって5以外になった場合は一覧を出さず、従来の説明文に戻す。
  const poolSize = result.pool?.length ?? 0
  const possible = possibleHands(icons ?? [], need, poolSize)
  const showHandList = need === 5 && poolSize >= 5

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onClick={close}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={close} aria-label="閉じる">✕</button>

        <p className={styles.eyebrow}>ログインスタンプ</p>
        <h2 className={styles.title}>
          {!pressed ? 'スタンプを押しています…'
            : hasHand ? `${info.level === 3 ? '🎊' : info.level === 2 ? '✨' : '🎯'} ${info.label}！`
            : 'スタンプを押しました！'}
        </h2>

        <div className={styles.grid}>
          {Array.from({ length: need }).map((_, i) => {
            const filled = i < filledNow
            // 今回押されたのは最後の1つ
            const isNew = pressed && i === count - 1
            const isGoal = i === need - 1
            const icon = stampIcon(icons?.[i], i)
            return (
              <div key={i}
                className={[
                  styles.box,
                  filled ? styles.boxFilled : '',
                  isNew ? styles.boxNew : '',
                  isGoal && !filled ? styles.boxGoal : '',
                ].filter(Boolean).join(' ')}>
                {filled
                  ? <img src={icon.src} alt={icon.label} className={styles.boxIcon}/>
                  : (isGoal ? `+${bonus}pt` : i + 1)}
              </div>
            )
          })}
        </div>

        {achieved ? (
          <div className={[
            styles.bonusBox,
            info.level === 3 ? styles.bonusBoxL3 : '',
            info.level === 2 ? styles.bonusBoxL2 : '',
          ].filter(Boolean).join(' ')}>
            <p className={styles.bonusTitle}>
              {hasHand ? `${info.label}（${info.note}）` : `🎉 ${need}個たまりました`}
            </p>
            <p className={styles.bonusText}>
              <strong>{granted}ポイント</strong>を獲得しました
            </p>
            {hasHand && handPoints > 0 && (
              <p className={styles.handBreak}>
                {need}日達成 {bonus}pt ＋ 役ボーナス {handPoints}pt
              </p>
            )}
            <p className={styles.bonusNote}>
              {info.level === 3 ? 'めったに出ない役です。カードは新しいものに変わります'
                                : 'カードは新しいものに変わります'}
            </p>
          </div>
        ) : (
          <>
            <p className={styles.progress}>
              あと <strong>{remaining}</strong> 個で {bonus}ポイント
            </p>
            {showHandList ? (
              <div className={styles.hands}>
                <p className={styles.handsHead}>
                  そろい方（役）に応じて、達成時におまけが付きます
                </p>
                <ul className={styles.handList}>
                  {HAND_ORDER.map(key => {
                    const info = HANDS[key]
                    const open = possible[key]
                    return (
                      <li key={key}
                        className={`${styles.handRow} ${open ? '' : styles.handRowOut}`}>
                        <span className={styles.handName}>{info.label}</span>
                        <span className={styles.handNote}>{info.note}</span>
                        {!open && <span className={styles.handOut}>むり</span>}
                      </li>
                    )
                  })}
                </ul>
                <p className={styles.handsFoot}>
                  灰色は、今の絵柄ではもう成立しない役です。
                </p>
              </div>
            ) : (
              <p className={styles.poolNote}>
                このカードの絵柄は {result.pool?.length ?? 0} 種類。
                そろい方（役）に応じて、達成時におまけが付きます。
              </p>
            )}
          </>
        )}

        <button className={styles.okBtn} onClick={close}>OK</button>
      </div>
    </div>
  )
}
