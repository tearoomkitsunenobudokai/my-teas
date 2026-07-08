'use client'

import Link from 'next/link'
import styles from './ai-analysis.module.css'

const TILES = [
  {
    href: '/dashboard/ai-analysis/advisor',
    icon: '🧑‍🔬',
    title: 'AIティーアドバイザーに聞く',
    desc: 'あなたが今まで飲んだお茶の評価から好みを分析し、コメントします。',
    badge: 'β',
    cost: '2pt',
  },
  {
    href: '/dashboard/ai-analysis/recommend',
    icon: '☕',
    title: 'オススメの1杯',
    desc: 'あなたの評価データから、次に飲むのにおすすめの一杯をご提案します。',
    badge: 'β',
    cost: '1pt',
  },
  {
    href: '/dashboard/ai-analysis/fortune',
    icon: '🔮',
    title: '紅茶おみくじ',
    desc: '今日のあなたにおすすめの一杯を占います。',
    badge: 'β',
    cost: '無料',
  },
]

export default function AIAnalysisPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>🤖 AI分析</h1>
      <p className={styles.lead}>
        あなたの評価データをもとに、AIがお茶の好みを分析したり、おすすめを提案する機能です。
        現在はプロトタイプ版（β）のため、簡易ロジックによる分析結果を表示しています。
      </p>

      <div className={styles.grid}>
        {TILES.map(t => (
          <Link key={t.href} href={t.href} className={styles.tile}>
            <span className={styles.tileBadge}>{t.badge}</span>
            <span className={styles.tileIcon}>{t.icon}</span>
            <span className={styles.tileTitle}>{t.title}</span>
            <span className={styles.tileDesc}>{t.desc}</span>
            <span className={styles.tileCost}>💎 {t.cost} 消費</span>
            <span className={styles.tileArrow}>分析してみる →</span>
          </Link>
        ))}
      </div>

      <div className={styles.note}>
        💡 今後、外部AI APIと連携してより精度の高い分析・提案を提供予定です。API連携には追加コストがかかるため、ポイント制を導入しています（製作者・管理者はポイント消費なしで利用できます）。
      </div>
    </div>
  )
}
