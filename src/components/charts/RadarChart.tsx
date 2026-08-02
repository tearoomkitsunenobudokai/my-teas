'use client'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { ReviewScores, SCORE_LABELS } from '@/types'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props { scores: ReviewScores; label?: string; size?: number; labelFontSize?: number; tickFontSize?: number; fluid?: boolean; verticalSideLabels?: boolean }

export default function RadarChart({ scores, label = '', size = 260, labelFontSize = 13, tickFontSize = 11, fluid = false, verticalSideLabels = false }: Props) {
  const keys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  /* 軸の並びは 上→右→下→左。verticalSideLabels=true のときは
     左右（コク・渋み）のラベルを1文字ずつ改行して縦書きにする。
     Chart.js は配列を渡すと複数行として描画するため、その仕組みを利用する。 */
  const labels = keys.map((k, i) => {
    const text = SCORE_LABELS[k]
    const isSide = i === 1 || i === 3
    return verticalSideLabels && isSide ? text.split('') : text
  })
  const data   = keys.map(k => scores[k] ?? 1)

  return (
    /* fluid=true のときは親要素の幅いっぱいに描画する（正方形を維持） */
    <div style={fluid
      ? { width: '100%', aspectRatio: '1 / 1', maxWidth: size }
      : { width: size, height: size, maxWidth: '100%' }}>
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
            pointRadius: 5,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 5,
              ticks: { stepSize: 1, font: { size: tickFontSize }, callback: (v: any) => `${v}` },
              pointLabels: { font: { size: labelFontSize, weight: 600 } },
            },
          },
        }}
      />
    </div>
  )
}
