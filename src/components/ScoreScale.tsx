import { ReviewScores, SCORE_LABELS, SCORE_DESCRIPTIONS } from '@/types'
import styles from './ScoreScale.module.css'

/*
 * 評価スコアを丸の並びで表す（v368）
 *
 * ★ 星（⭐）ではなく丸（●○）を使っている。
 *   この4項目は「多いほど良い」ではなく強弱・濃淡を表すもので、
 *   星だと優劣の評価に見えてしまうため。
 *
 * 同じ理由で両端に語（弱⇔強 / 薄い⇔濃い など）を必ず添える。
 * 語は入力画面と同じ SCORE_DESCRIPTIONS から取るので、
 * 入力時の表示と食い違わない。
 */

const MAX = 5
const ORDER: (keyof ReviewScores)[] = [
  'score_aroma', 'score_richness', 'score_color_depth', 'score_astringency',
]

export default function ScoreScale({ scores }: { scores: ReviewScores }) {
  return (
    <div className={styles.wrap}>
      {ORDER.map(key => {
        const v = scores[key] ?? 0
        const d = SCORE_DESCRIPTIONS[key]
        return (
          <div key={key} className={styles.row}>
            <span className={styles.name}>{SCORE_LABELS[key]}</span>
            <span className={styles.edge}>{d.weak}</span>
            <span className={styles.dots} aria-label={`${SCORE_LABELS[key]} ${v} / ${MAX}`}>
              {Array.from({ length: MAX }, (_, i) => (
                <span
                  key={i}
                  className={i < v ? styles.dotOn : styles.dotOff}
                  aria-hidden="true"
                />
              ))}
            </span>
            <span className={styles.edge}>{d.strong}</span>
          </div>
        )
      })}
    </div>
  )
}
