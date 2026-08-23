'use client'
import { useEffect, useState } from 'react'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { ReviewScores, SCORE_LABELS } from '@/types'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props {
  scores: ReviewScores; label?: string; size?: number
  /** スマホ表示のときの最大サイズ（未指定なら size と同じ）
      ★ この値はインラインの style で入るため、CSS の max-width では上書きできない。
         一覧の大きさを変えたいときは CSS ではなくこの props を変えること。（v367） */
  mobileSize?: number
  /** スマホ表示のときの文字サイズ */
  labelFontSize?: number; tickFontSize?: number
  /** PC表示のときの文字サイズ（未指定なら既定値を使う） */
  desktopLabelFontSize?: number; desktopTickFontSize?: number
  fluid?: boolean; verticalSideLabels?: boolean
}

/* スマホ表示かどうかを判定する。CSSのメディアクエリと同じ条件を使い、
   PCではラベルが大きくなりすぎないよう文字サイズを切り替える。 */
const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse) and (max-width: 1100px)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}

export default function RadarChart({
  scores, label = '', size = 260, mobileSize,
  labelFontSize = 13, tickFontSize = 11,
  desktopLabelFontSize = 13, desktopTickFontSize = 11,
  fluid = false, verticalSideLabels = false,
}: Props) {
  const isMobile = useIsMobile()
  const labelFs = isMobile ? labelFontSize : desktopLabelFontSize
  const tickFs  = isMobile ? tickFontSize  : desktopTickFontSize
  // スマホだけ小さくしたい場合に mobileSize を使う（未指定なら従来どおり size）
  const boxSize = isMobile ? (mobileSize ?? size) : size
  const keys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  /* 軸の並びは 上→右→下→左。verticalSideLabels=true のときは
     左右（コク・渋み）のラベルを1文字ずつ改行して縦書きにする。
     Chart.js は配列を渡すと複数行として描画するため、その仕組みを利用する。 */
  const labels = keys.map((k, i) => {
    const text = SCORE_LABELS[k]
    const isSide = i === 1 || i === 3
    /* 縦書きは画面幅にかかわらず適用し、スマホとPCで見た目を揃える。 */
    return verticalSideLabels && isSide ? text.split('') : text
  })
  const data   = keys.map(k => scores[k] ?? 1)

  return (
    /* fluid=true のときは親要素の幅いっぱいに描画する（正方形を維持） */
    <div style={fluid
      ? { width: '100%', aspectRatio: '1 / 1', maxWidth: boxSize, margin: '0 auto' }
      : { width: boxSize, height: boxSize, maxWidth: '100%' }}>
      <Radar
        data={{
          labels,
          datasets: [{
            label,
            data,
            backgroundColor: 'rgba(29,158,117,0.18)',
            borderColor: '#1D9E75',
            pointBackgroundColor: '#1D9E75',
            borderWidth: 2,
            /* PCではタイルが複数列に並び1枚が小さくなるため、点も小さくする */
            pointRadius: isMobile ? 5 : 3.5,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 5,
              ticks: { stepSize: 1, font: { size: tickFs }, callback: (v: any) => `${v}` },
              pointLabels: {
                font: { size: labelFs, weight: 600 },
                /* 軸名（香り・コク・水色・渋み）の背景に薄い青を敷いて読みやすくする */
                backdropColor: 'rgba(214, 233, 250, 0.9)',
                backdropPadding: isMobile
                  ? { top: 4, bottom: 4, left: 7, right: 7 }
                  : { top: 3, bottom: 3, left: 5, right: 5 },
              },
            },
          },
        }}
      />
    </div>
  )
}
