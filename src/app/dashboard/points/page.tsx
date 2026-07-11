'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import styles from './points.module.css'

const TYPE_LABEL: Record<string, string> = {
  monthly_grant: '月額プラン付与',
  purchase: 'ポイント購入',
  consumption: 'AI分析で消費',
  carryover_expiry: '繰越上限による失効',
  admin_adjust: '管理者による調整',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return '終了しました'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days > 0) return `あと${days}日${hours}時間`
  return `あと${hours}時間`
}

export default function PointsPage() {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [ledger, setLedger] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comingSoon, setComingSoon] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data: profile }, { data: entries }, { data: pkgs }] = await Promise.all([
      supabase.from('profiles').select('is_admin,is_creator,points').eq('id', user.id).single(),
      supabase.from('points_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('point_packages').select('*').eq('is_active', true).order('sort_order'),
    ])
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)
    setLedger(entries ?? [])
    // 期間限定オファーは期限切れのものを除外して表示する
    const now = Date.now()
    setPackages((pkgs ?? []).filter(p => !p.is_limited || !p.limited_until || new Date(p.limited_until).getTime() > now))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function showComingSoon(msg: string) {
    setComingSoon(msg)
    setTimeout(() => setComingSoon(null), 3500)
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← ダッシュボードに戻る</Link>
      <h1 className={styles.title}>💎 ポイント</h1>
      <p className={styles.lead}>AI分析機能（AIティーアドバイザー・オススメの1杯）の利用に使うポイントです。</p>

      {loading ? (
        <p className={styles.hint}>読み込み中…</p>
      ) : (
        <>
          <div className={styles.balanceCard}>
            <span className={styles.balanceLabel}>現在の所持ポイント</span>
            <span className={styles.balanceNum}>{isAdmin ? '∞' : points}<span className={styles.balanceUnit}>pt</span></span>
            {isAdmin && <span className={styles.balanceNote}>管理者・製作者はポイント消費なしで全機能を利用できます</span>}
          </div>

          {comingSoon && <div className={styles.comingSoonBanner}>🚧 {comingSoon}</div>}

          {/* ポイント購入（モック） */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>🛒 ポイントを購入</h2>
            <div className={styles.packageGrid}>
              {packages.map(p => (
                <div key={p.id} className={`${styles.packageCard} ${p.is_limited ? styles.packageCardLimited : ''}`}>
                  <span className={styles.packageBadge}>{p.label}</span>
                  {p.is_limited && p.limited_until && (
                    <span className={styles.packageLimitedNote}>⏰ {fmtRemaining(p.limited_until)}・お一人様1回限り</span>
                  )}
                  <span className={styles.packagePt}>{p.points}pt</span>
                  <span className={styles.packageYen}>¥{p.price_yen.toLocaleString()}</span>
                  <button className={styles.packageBtn}
                    onClick={() => showComingSoon('ポイント購入機能は準備中です。決済連携完了後にご利用いただけます。')}>
                    購入する
                  </button>
                </div>
              ))}
            </div>
            <p className={styles.hint}>※ 現在は動作確認用のモック表示です。実際の決済・ポイント付与はまだ行われません。</p>
          </section>

          {/* 履歴 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>📜 ポイント履歴</h2>
            {ledger.length === 0 ? (
              <p className={styles.hint}>まだ履歴がありません。</p>
            ) : (
              <div className={styles.ledgerList}>
                {ledger.map(e => (
                  <div key={e.id} className={styles.ledgerRow}>
                    <div className={styles.ledgerLeft}>
                      <span className={styles.ledgerType}>{TYPE_LABEL[e.type] ?? e.type}</span>
                      <span className={styles.ledgerDate}>{fmtDate(e.created_at)}</span>
                    </div>
                    <span className={`${styles.ledgerAmount} ${e.amount >= 0 ? styles.ledgerPlus : styles.ledgerMinus}`}>
                      {e.amount >= 0 ? '+' : ''}{e.amount}pt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
