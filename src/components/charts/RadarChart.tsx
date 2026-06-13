'use client'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { ReviewScores, SCORE_LABELS } from '@/types'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props {
  scores: ReviewScores
  label?: string
  size?: number
}

export default function RadarChart({ scores, label = '', size = 300 }: Props) {
  const labels = Object.keys(SCORE_LABELS).map(k => SCORE_LABELS[k as keyof ReviewScores])
  const data = Object.keys(SCORE_LABELS).map(k => scores[k as keyof ReviewScores])

  return (
    <div style={{ width: size, height: size, maxWidth: '100%' }}>
      <Radar
        data={{
          labels,
          datasets: [{
            label,
            data,
            backgroundColor: 'rgba(29,158,117,0.15)',
            borderColor: '#1D9E75',
            pointBackgroundColor: '#1D9E75',
            borderWidth: 2,
            pointRadius: 4,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 10,
              ticks: { stepSize: 2, font: { size: 11 } },
              pointLabels: { font: { size: 12 } },
            },
          },
        }}
      />
    </div>
  )
}
