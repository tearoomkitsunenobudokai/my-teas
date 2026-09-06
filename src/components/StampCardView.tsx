'use client'

import { stampIcon, handInfo, possibleHands, HANDS, HAND_ORDER } from '@/lib/stampIcons'
import styles from './LoginBonus.module.css'

// ログインスタンプのポップアップの中身。
//
// 見た目だけを持ち、通信は一切しない。
// ・LoginBonus …… ログイン時に実際に押されたときの表示
// ・ポイント画面の「いまのスタンプを見る」…… 確認用の表示（preview）
// の2か所から同じものを使う。
//
// 分けている理由は、確認用の画面を別に作ると本番と見た目がずれ、
// 不具合を見逃すため。中身は必ずここ1か所だけにする。
//
// preview のときはポイントの付与に関わる処理を持たない。
// 呼び出し側も record_login_and_grant_v4 を呼ばないこと。

export type StampCardProps = {
  count: number         // 押してある個数
  need: number          // マスの数
  bonus: number         // 達成時のポイント
  icons: string[]       // 引いた絵柄を古い順に
  poolSize: number      // このカードで使う絵柄の種類数
  granted?: number      // 今回もらったポイント（確認用の表示では 0）
  hand?: string
  handPoints?: number
  pressed: boolean      // 最後の1つを押し終えたか
  preview?: boolean     // 確認用の表示か
  onClose: () => void
}

export default function StampCardView({
  count, need, bonus, icons, poolSize,
  granted = 0, hand = 'none', handPoints = 0,
  pressed, preview = false, onClose,
}: StampCardProps) {
  const info = handInfo(hand)
  const hasHand = info.level > 0
  // count は「押した後」の個数。押す前は1つ少ない。
  const filledNow = pressed ? count : count - 1
  const remaining = Math.max(0, need - count)
  const achieved = granted > 0

  // まだ成立しうる役。マスが5つのときだけ6役がそろうので、
  // 設定が変わって5以外になった場合は一覧を出さず、従来の説明文に戻す。
  const possible = possibleHands(icons ?? [], need, poolSize)
  const showHandList = need === 5 && poolSize >= 5

  return (
    <div className={styles.card} onClick={e => e.stopPropagation()}>
      <button className={styles.close} onClick={onClose} aria-label="閉じる">✕</button>

      <p className={styles.eyebrow}>ログインスタンプ</p>
      <h2 className={styles.title}>
        {preview ? 'いまのスタンプ'
          : !pressed ? 'スタンプを押しています…'
          : hasHand ? `${info.level === 3 ? '🎊' : info.level === 2 ? '✨' : '🎯'} ${info.label}！`
          : 'スタンプを押しました！'}
      </h2>

      <div className={styles.grid}>
        {Array.from({ length: need }).map((_, i) => {
          const filled = i < filledNow
          // 今回押されたのは最後の1つ。確認用の表示では光らせない。
          const isNew = !preview && pressed && i === count - 1
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
                  const h = HANDS[key]
                  const open = possible[key]
                  return (
                    <li key={key}
                      className={`${styles.handRow} ${open ? '' : styles.handRowOut}`}>
                      <span className={styles.handName}>{h.label}</span>
                      <span className={styles.handNote}>{h.note}</span>
                      {!open && <span className={styles.handOut}>失敗</span>}
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
              このカードの絵柄は {poolSize} 種類。
              そろい方（役）に応じて、達成時におまけが付きます。
            </p>
          )}
        </>
      )}

      {preview && (
        <p className={styles.previewNote}>
          確認用の表示です。開いてもスタンプやポイントは増えません。
        </p>
      )}

      <button className={styles.okBtn} onClick={onClose}>OK</button>
    </div>
  )
}
