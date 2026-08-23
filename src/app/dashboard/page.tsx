'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import TeaCup from '@/components/TeaCup'
import styles from './dashboard.module.css'

function hexToRgba(hex: string, a = 0.78): string {
  const h = (hex ?? '').replace('#', '').slice(0, 6)
  if (h.length === 6) return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
  return `rgba(200,169,110,${a})`
}

// 水色カップの描画は共通コンポーネント @/components/TeaCup を使用

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, public: 0 })
  const [points, setPoints] = useState<number | null>(null)
  const [pointsUnlimited, setPointsUnlimited] = useState(false)
  const [loginCount, setLoginCount] = useState(0)
  const [stampDays, setStampDays] = useState(5)
  const [stampPoints, setStampPoints] = useState(2)
  const [showStamp, setShowStamp] = useState(false)
  const [topTeas, setTopTeas] = useState<any[]>([])
  const [topShops, setTopShops] = useState<any[]>([])
  const [topAroma, setTopAroma] = useState<any[]>([])
  const [recentReviews, setRecentReviews] = useState<any[]>([])
  const [avgScores, setAvgScores] = useState<any>(null)

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) return

    const { data: reviews } = await supabase
      .from('reviews')
      .select('tea_name, shop_name, aroma_notes, color_hex, score_aroma, score_astringency, score_richness, score_color_depth, is_public, drank_at, created_at')
      .eq('user_id', user.id)

    // 所持ポイント（管理者・製作者は消費なし＝無制限扱い）
    const { data: profile } = await supabase.from('profiles')
      .select('points,is_admin,is_creator,login_count').eq('id', user.id).single()
    if (profile) {
      setPoints(profile.points ?? 0)
      setPointsUnlimited(!!(profile.is_admin || profile.is_creator))
      setLoginCount(profile.login_count ?? 0)
    }
    // スタンプカードの設定（必要日数・付与ポイント）
    const { data: bonusSettings } = await supabase.from('app_settings')
      .select('key,value').in('key', ['login_bonus_days', 'login_bonus_points'])
    if (bonusSettings) {
      const m: any = {}
      for (const r of bonusSettings) m[r.key] = r.value
      setStampDays(parseInt(m['login_bonus_days'] ?? '5') || 5)
      setStampPoints(parseInt(m['login_bonus_points'] ?? '2') || 2)
    }

    if (!reviews) { setLoading(false); return }

    // 基本統計
    setStats({
      total: reviews.length,
      public: reviews.filter(r => r.is_public).length,
    })

    // よく飲む紅茶TOP5（tea_name で集計）
    const teaCount: Record<string, { count: number; color?: string }> = {}
    reviews.forEach(r => {
      if (!r.tea_name) return
      if (!teaCount[r.tea_name]) teaCount[r.tea_name] = { count: 0, color: r.color_hex }
      teaCount[r.tea_name].count++
    })
    const topT = Object.entries(teaCount)
      .map(([name, v]) => ({ name, count: v.count, color: v.color }))
      .sort((a, b) => b.count - a.count).slice(0, 5)
    setTopTeas(topT)

    // よく行くお店TOP5（shop_name で集計）
    const shopCount: Record<string, number> = {}
    reviews.forEach(r => {
      if (!r.shop_name) return
      shopCount[r.shop_name] = (shopCount[r.shop_name] ?? 0) + 1
    })
    const topS = Object.entries(shopCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5)
    setTopShops(topS)

    // よく選ぶ香りTOP5（aroma_notes を展開して集計）
    const aromaCount: Record<string, number> = {}
    reviews.forEach(r => {
      (r.aroma_notes ?? []).forEach((n: string) => {
        aromaCount[n] = (aromaCount[n] ?? 0) + 1
      })
    })
    const topA = Object.entries(aromaCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8)
    setTopAroma(topA)

    // 平均スコア
    if (reviews.length > 0) {
      const avg = (key: string) => {
        const vals = reviews.map((r: any) => r[key]).filter((v: any) => v != null)
        return vals.length ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : '-'
      }
      setAvgScores({
        aroma: avg('score_aroma'),
        astringency: avg('score_astringency'),
        richness: avg('score_richness'),
        colorDepth: avg('score_color_depth'),
      })
    }

    // 最近の評価3件
    const recent = [...reviews]
      .sort((a, b) => (b.drank_at ?? b.created_at ?? '').localeCompare(a.drank_at ?? a.created_at ?? ''))
      .slice(0, 3)
    setRecentReviews(recent)

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const maxTeaCount = topTeas[0]?.count ?? 1
  const maxShopCount = topShops[0]?.count ?? 1
  const maxAromaCount = topAroma[0]?.count ?? 1

  if (loading) return <div className={styles.loading}>読み込み中…</div>

  return (
    <div className={styles.page}>
      {/* タイトル〜基本統計までを上部に固定する */}
      <div className={styles.stickyHead}>
      <h1 className={styles.title}>📊 統計</h1>

      {/* ─── 基本統計カード ─── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.total}</span>
          <span className={styles.statLabel}>評価数</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.public}</span>
          <span className={styles.statLabel}>公開中</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{topTeas.length > 0 ? topTeas.length : '—'}</span>
          <span className={styles.statLabel}>登録茶葉種</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{topShops.length > 0 ? topShops.length : '—'}</span>
          <span className={styles.statLabel}>訪問店舗数</span>
        </div>
      </div>
      </div>

      {/* ─── ポイント・ログインカード（固定しない） ─── */}
      <div className={styles.statsRow}>
        <Link href="/dashboard/points" className={`${styles.statCard} ${styles.statCardLink}`}>
          <span className={styles.statNum}>{pointsUnlimited ? '∞' : (points ?? '—')}<span className={styles.statPt}>💎</span></span>
          <span className={styles.statLabel}>所持ポイント</span>
        </Link>
        <button className={`${styles.statCard} ${styles.statCardLink}`} onClick={() => setShowStamp(true)}>
          <span className={styles.statNum}>{Math.min(loginCount, stampDays)}<span className={styles.statPt}>/{stampDays}</span></span>
          <span className={styles.statLabel}>ログインカード</span>
        </button>
      </div>

      {showStamp && (
        <div className={styles.stampOverlay} onClick={() => setShowStamp(false)}>
          <div className={styles.stampCard} onClick={e => e.stopPropagation()}>
            <button className={styles.stampClose} onClick={() => setShowStamp(false)}>✕</button>
            <h2 className={styles.stampTitle}>🎴 ログインスタンプカード</h2>
            <p className={styles.stampDesc}>
              毎日ログインでスタンプが1つたまります。<br/>
              <strong>{stampDays}個</strong>たまると <strong>{stampPoints}ポイント</strong> プレゼント！
            </p>
            <div className={styles.stampGrid}>
              {Array.from({ length: stampDays }).map((_, i) => {
                const progress = Math.min(loginCount, stampDays)
                const filled = i < progress
                const isLast = i === stampDays - 1
                return (
                  <div key={i} className={`${styles.stampBox} ${filled ? styles.stampBoxFilled : ''} ${isLast ? styles.stampBoxGoal : ''}`}>
                    {filled ? '🍵' : (isLast ? `+${stampPoints}pt` : i + 1)}
                  </div>
                )
              })}
            </div>
            <p className={styles.stampProgress}>
              あと <strong>{Math.max(0, stampDays - Math.min(loginCount, stampDays))}</strong> 個で {stampPoints}ポイント獲得
            </p>
          </div>
        </div>
      )}

      {stats.total === 0 ? (
        <div className={styles.empty}>
          <p>まだ評価が登録されていません</p>
          <Link href="/dashboard/reviews" className={styles.startBtn}>
            + 最初の評価を登録する
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* ─── よく飲む紅茶 ─── */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>☕ よく飲む紅茶</h2>
            {topTeas.length === 0 ? <p className={styles.noData}>データなし</p> : (
              <div className={styles.rankList}>
                {topTeas.map((t, i) => (
                  <div key={t.name} className={styles.rankRow}>
                    <span className={styles.rank}>{i + 1}</span>
                    <TeaCup hex={t.color} size={36}/>
                    <div className={styles.rankInfo}>
                      <span className={styles.rankName}>{t.name}</span>
                      <div className={styles.bar}>
                        <div className={styles.barFill}
                          style={{ width: `${(t.count / maxTeaCount) * 100}%`, background: hexToRgba(t.color ?? '#C8A96E', 0.7) }}/>
                      </div>
                    </div>
                    <span className={styles.rankCount}>{t.count}回</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── よく行くお店 ─── */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>🏪 よく行くお店</h2>
            {topShops.length === 0 ? <p className={styles.noData}>お店の登録がありません</p> : (
              <div className={styles.rankList}>
                {topShops.map((s, i) => (
                  <div key={s.name} className={styles.rankRow}>
                    <span className={styles.rank}>{i + 1}</span>
                    <span className={styles.shopIcon}>🏪</span>
                    <div className={styles.rankInfo}>
                      <span className={styles.rankName}>{s.name}</span>
                      <div className={styles.bar}>
                        <div className={styles.barFill}
                          style={{ width: `${(s.count / maxShopCount) * 100}%`, background: 'var(--green)', opacity: 0.6 }}/>
                      </div>
                    </div>
                    <span className={styles.rankCount}>{s.count}回</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── よく選ぶ香り ─── */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>🌸 よく選ぶ香り</h2>
            {topAroma.length === 0 ? <p className={styles.noData}>香り分析の登録がありません</p> : (
              <div className={styles.aromaGrid}>
                {topAroma.map((a, i) => (
                  <div key={a.name} className={styles.aromaItem}
                    style={{ opacity: 0.5 + (a.count / maxAromaCount) * 0.5 }}>
                    <span className={styles.aromaName}>{a.name}</span>
                    <span className={styles.aromaCount}>{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── 平均スコア ─── */}
          {avgScores && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>📊 平均スコア傾向</h2>
              <div className={styles.scoreList}>
                {[
                  { label: '香り', key: 'aroma', weak: '弱', strong: '強' },
                  { label: '渋み', key: 'astringency', weak: '弱', strong: '強' },
                  { label: 'コク', key: 'richness', weak: '少', strong: '多' },
                  { label: '水色', key: 'colorDepth', weak: '薄', strong: '濃' },
                ].map(s => (
                  <div key={s.key} className={styles.scoreRow}>
                    <span className={styles.scoreLabel}>{s.label}</span>
                    <span className={styles.scoreEdge}>{s.weak}</span>
                    <div className={styles.scorebar}>
                      <div className={styles.scorebarFill}
                        style={{ width: `${((parseFloat(avgScores[s.key]) - 1) / 4) * 100}%` }}/>
                    </div>
                    <span className={styles.scoreEdge}>{s.strong}</span>
                    <span className={styles.scorebarVal}>{avgScores[s.key]}</span>
                  </div>
                ))}
              </div>
              <p className={styles.scoreTrend}>
                {(() => {
                  if (!avgScores) return ''
                  const a = parseFloat(avgScores.aroma)
                  const r = parseFloat(avgScores.richness)
                  const t = parseFloat(avgScores.astringency)
                  const c = parseFloat(avgScores.colorDepth)
                  const parts = []
                  if (a >= 3.5) parts.push('香り豊か')
                  if (r >= 3.5) parts.push('コクがある')
                  if (t >= 3.5) parts.push('渋みが強い')
                  if (t <= 2.5) parts.push('渋みが少ない')
                  if (c >= 3.5) parts.push('水色が濃い')
                  if (c <= 2.5) parts.push('水色が薄い')
                  if (parts.length === 0) parts.push('バランスの良い')
                  return `好みの傾向: ${parts.join('・')}お茶`
                })()}
              </p>
            </div>
          )}

          {/* ─── 最近の評価 ─── */}
          <div className={`${styles.card} ${styles.cardWide}`}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>🕐 最近の評価</h2>
              <Link href="/dashboard/reviews" className={styles.moreLink}>すべて見る →</Link>
            </div>
            <div className={styles.recentList}>
              {recentReviews.map(r => (
                <div key={r.tea_name + r.drank_at} className={styles.recentRow}>
                  <TeaCup hex={r.color_hex} size={40}/>
                  <div className={styles.recentInfo}>
                    <span className={styles.recentName}>{r.tea_name ?? '不明'}</span>
                    {r.shop_name && <span className={styles.recentShop}>🏪 {r.shop_name}</span>}
                    {(r.aroma_notes ?? []).length > 0 && (
                      <div className={styles.recentAroma}>
                        {(r.aroma_notes as string[]).slice(0,3).map(n => (
                          <span key={n} className={styles.recentAromaTag}>{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={styles.recentDate}>
                    {(r.drank_at ?? r.created_at?.slice(0,10) ?? '').replace(/-/g,'/')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
