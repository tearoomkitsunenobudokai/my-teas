'use client'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { ReviewScores, SCORE_LABELS } from '@/types'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props { scores: ReviewScores; label?: string; size?: number }

export default function RadarChart({ scores, label = '', size = 260 }: Props) {
  const keys = Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]
  const labels = keys.map(k => SCORE_LABELS[k])
  const data   = keys.map(k => scores[k] ?? 1)

  return (
    <div style={{ width: size, height: size, maxWidth: '100%' }}>
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
              ticks: { stepSize: 1, font: { size: 11 }, callback: (v: any) => `${v}` },
              pointLabels: { font: { size: 13, weight: 600 } },
            },
          },
        }}
      />
    </div>
  )
}
