'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  stampIcon, STAMP_ICONS,
  HANDS, HAND_ORDER, HAND_SAMPLES, HAND_ODDS,
} from '@/lib/stampIcons'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import styles from './points.module.css'

const TYPE_LABEL: Record<string, string> = {
  monthly_grant: '月額プラン付与',
  purchase: 'ポイント購入',
  consumption: 'AI分析で消費',
  carryover_expiry: 'ポイント失効',
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

// 履歴の表示テキストを組み立てる。
//  ・消費（consumption）: description に機能キー（'summary'等）が入っているので、
//    feature_costs のラベルに変換して「AI要約（通常）」のように表示する
//  ・購入（purchase）: description に既にプラン名が入っている（例: 「お試しプラン（無料配布）」）ので
//    そのまま使う
//  ・その他: 種別名 + 補足があれば括弧で付記
function formatLedgerEntry(e: any, featureLabels: Record<string, string>): string {
  if (e.type === 'consumption') {
    const label = e.description ? (featureLabels[e.description] ?? e.description) : null
    return label ? `ポイント消費・${label}` : 'ポイント消費'
  }
  if (e.type === 'purchase') {
    return e.description ? `ポイント購入・${e.description}` : 'ポイント購入'
  }
  const base = TYPE_LABEL[e.type] ?? e.type
  return e.description ? `${base}・${e.description}` : base
}

export default function PointsPage() {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [pointsFree, setPointsFree] = useState(0)
  const [pointsPaid, setPointsPaid] = useState(0)
  const [expiringLots, setExpiringLots] = useState<any[]>([])
  // ログインスタンプ（ダッシュボードと同じ内容をここでも確認できるようにする）
  const [stampCount, setStampCount] = useState(0)
  const [stampIcons, setStampIcons] = useState<string[]>([])
  const [stampDays, setStampDays] = useState(5)
  const [stampBonus, setStampBonus] = useState(2)
  const [handPoints, setHandPoints] = useState<Record<string, number>>({})
  const [showHands, setShowHands] = useState(false)
  const [ledger, setLedger] = useState<any[]>([])
  const [featureLabels, setFeatureLabels] = useState<Record<string, string>>({})
  const [packages, setPackages] = useState<any[]>([])
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set())
  const [claiming, setClaiming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [comingSoon, setComingSoon] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  // 決済から戻ってきたときの案内
  const [purchaseMsg, setPurchaseMsg] = useState('')

  const load = useCallback(async () => {
    /* この画面はRPC1本＋クエリ6本を一度に投げるため、他の画面より通信が多い。
       アクセストークンの期限が切れていると、それらが同時にトークンの更新を試み、
       先に成功した1本以外が無効なトークンで更新しようとして失敗し、
       セッションごと破棄されてログイン画面へ飛ばされることがある。

       そこで、通信を始める前に getUser() を1回だけ待つ。
       getUser() はサーバーに問い合わせて必要なら更新まで済ませるので、
       このあとの並列リクエストは有効なトークンで実行され、更新が重ならない。 */
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) { setLoading(false); return }
    /* 表示前に、自分の期限切れ無料ポイントを整理しておく（残高表示のズレを防ぐ）。
       ここで失敗しても残高は表示できるので、画面は続行する。 */
    const { error: sweepErr } = await supabase.rpc('sweep_expired_free_points', { p_user_id: user.id })
    if (sweepErr) console.error('期限切れポイントの整理に失敗しました', sweepErr)
    const [{ data: profile }, { data: entries }, { data: pkgs }, { data: claims }, { data: costs }, { data: lots }, { data: settings }] = await Promise.all([
      supabase.from('profiles').select('is_admin,is_creator,points,points_free,points_paid,login_count,stamp_icons').eq('id', user.id).single(),
      supabase.from('points_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('point_packages').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('point_package_claims').select('package_id,period_key').eq('user_id', user.id),
      supabase.from('feature_costs').select('feature,label'),
      supabase.from('point_lots').select('amount,expires_at,source').eq('user_id', user.id).eq('kind', 'free').gt('amount', 0).order('expires_at', { ascending: true }),
      supabase.from('app_settings').select('key,value')
        .in('key', ['login_bonus_days', 'login_bonus_points',
                    'stamp_hand_five', 'stamp_hand_four', 'stamp_hand_complete',
                    'stamp_hand_full', 'stamp_hand_three', 'stamp_hand_twopair']),
    ])
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)
    setPointsFree(profile?.points_free ?? 0)
    setPointsPaid(profile?.points_paid ?? 0)
    setExpiringLots(lots ?? [])
    setStampCount(profile?.login_count ?? 0)
    setStampIcons(profile?.stamp_icons ?? [])
    const sm: Record<string, string> = {}
    for (const r of settings ?? []) sm[r.key] = r.value
    setStampDays(parseInt(sm['login_bonus_days'] ?? '5', 10) || 5)
    setStampBonus(parseInt(sm['login_bonus_points'] ?? '2', 10) || 2)
    setHandPoints({
      five:     parseInt(sm['stamp_hand_five']     ?? '30', 10) || 0,
      four:     parseInt(sm['stamp_hand_four']     ?? '10', 10) || 0,
      complete: parseInt(sm['stamp_hand_complete'] ?? '8',  10) || 0,
      full:     parseInt(sm['stamp_hand_full']     ?? '3',  10) || 0,
      three:    parseInt(sm['stamp_hand_three']    ?? '0',  10) || 0,
      twopair:  parseInt(sm['stamp_hand_twopair']  ?? '0',  10) || 0,
    })
    setLedger(entries ?? [])
    const fm: Record<string, string> = {}
    for (const c of costs ?? []) fm[c.feature] = c.label
    setFeatureLabels(fm)
    // 期間限定オファーは期限切れのものを除外して表示する
    const now = Date.now()
    setPackages((pkgs ?? []).filter(p => !p.is_limited || !p.limited_until || new Date(p.limited_until).getTime() > now))
    setClaimedKeys(new Set((claims ?? []).map((c: any) => `${c.package_id}:${c.period_key}`)))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  /* 決済ページから戻ってきたときの案内。
     ポイントの付与はStripeからの通知で行われるため、
     戻った直後はまだ反映されていないことがある。その旨を伝える。 */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('purchase')
    if (q === 'success') {
      setPurchaseMsg('お支払いありがとうございます。ポイントの反映まで少し時間がかかる場合があります。')
      // 反映済みかもしれないので、少し待ってから残高を取り直す
      const t = setTimeout(() => load(), 3000)
      window.history.replaceState({}, '', '/dashboard/points')
      return () => clearTimeout(t)
    }
    if (q === 'cancel') {
      setPurchaseMsg('お支払いは行われていません。')
      window.history.replaceState({}, '', '/dashboard/points')
    }
  }, [load])

  function showComingSoon(msg: string) {
    setComingSoon(msg)
    setTimeout(() => setComingSoon(null), 3500)
  }

  function periodKeyOf(p: any): string {
    return p.is_limited && p.limited_until ? p.limited_until : 'permanent'
  }

  /* 購入手続きを始める。
     金額とポイント数はサーバー側でDBから読み直すので、
     ここからはどのプランかだけを送る。 */
  async function startCheckout(pkg: any) {
    if (buying) return
    setBuying(pkg.id)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        alert(data.error ?? '決済ページを開けませんでした')
        return
      }
      // Stripeの決済ページへ移動する
      window.location.href = data.url
    } catch {
      alert('通信に失敗しました。時間をおいてお試しください。')
    } finally {
      setBuying(null)
    }
  }

  async function claimFree(p: any) {
    setClaiming(p.id)
    try {
      const { data, error } = await supabase.rpc('claim_free_package', { p_package_id: p.id })
      if (error) { alert(error.message); return }
      if (data?.success === false) { alert(data.message || '受け取れませんでした'); return }
      alert(`🎉 ${data.points}pt を獲得しました！`)
      await load()
    } finally {
      setClaiming(null)
    }
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
            {!isAdmin && (
              <div className={styles.balanceBreakdown}>
                <span className={styles.breakdownItem}>🎁 無料ポイント　<b>{pointsFree}pt</b></span>
                <span className={styles.breakdownItem}>💳 購入ポイント（無期限）　<b>{pointsPaid}pt</b></span>
              </div>
            )}
            {!isAdmin && expiringLots.length > 0 && (
              <div className={styles.expiryNote}>
                ⏳ 無料ポイントの有効期限
                <ul className={styles.expiryList}>
                  {expiringLots.map((l, i) => (
                    <li key={i}>
                      {l.amount}pt — {new Date(l.expires_at).toLocaleDateString('ja-JP')}まで
                      {l.source ? `（${l.source}）` : ''}
                    </li>
                  ))}
                </ul>
                <span className={styles.expiryHint}>※ ポイント消費時は、無料ポイントから先に使われます。</span>
              </div>
            )}
          </div>

          {/* ログインスタンプ。ダッシュボードでも見られるが、
              ポイントの入手方法として、この画面でも確認できるようにしている。 */}
          {!isAdmin && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>🎴 ログインスタンプ</h2>
              <div className={styles.stampCard}>
                <p className={styles.stampLead}>
                  毎日ログインするとスタンプが1つ押されます。
                  {stampDays}個たまると<b>{stampBonus}pt</b>もらえます。
                </p>
                <div className={styles.stampGrid}>
                  {Array.from({ length: stampDays }).map((_, i) => {
                    const filled = i < stampCount
                    const icon = stampIcon(stampIcons[i], i)
                    return (
                      <div key={i} className={`${styles.stampBox} ${filled ? styles.stampBoxFilled : ''}`}>
                        {filled
                          ? <img src={icon.src} alt={icon.label} className={styles.stampBoxIcon}/>
                          : <span className={styles.stampBoxNum}>{i + 1}</span>}
                      </div>
                    )
                  })}
                </div>
                <p className={styles.stampFoot}>
                  {stampCount >= stampDays
                    ? 'あと少しで達成です。'
                    : `あと ${stampDays - stampCount} 個で ${stampBonus}pt`}
                </p>
                <button type="button" className={styles.handLink} onClick={() => setShowHands(true)}>
                  🎴 絵柄のそろい方（役）を見る
                </button>
              </div>
            </section>
          )}

          {comingSoon && <div className={styles.comingSoonBanner}>🚧 {comingSoon}</div>}
          {purchaseMsg && <div className={styles.comingSoonBanner}>💳 {purchaseMsg}</div>}

          {/* ポイント購入（モック） */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>🛒 ポイントを購入</h2>
            <div className={styles.packageGrid}>
              {packages.map(p => {
                const isFree = p.price_yen === 0
                const claimed = isFree && claimedKeys.has(`${p.id}:${periodKeyOf(p)}`)
                return (
                  <div key={p.id} className={`${styles.packageCard} ${p.is_limited ? styles.packageCardLimited : ''}`}>
                    <span className={styles.packageBadge}>{p.label}</span>
                    {p.is_limited && p.limited_until && (
                      <span className={styles.packageLimitedNote}>⏰ {fmtRemaining(p.limited_until)}・お一人様1回限り</span>
                    )}
                    <span className={styles.packagePt}>{p.points}pt</span>
                    <span className={styles.packageYen}>{isFree ? '無料' : `¥${p.price_yen.toLocaleString()}`}</span>
                    {isFree ? (
                      <button className={styles.packageBtn} disabled={claimed || claiming === p.id}
                        onClick={() => claimFree(p)}>
                        {claimed ? '✅ 受け取り済み' : claiming === p.id ? '処理中…' : '🎁 無料で受け取る'}
                      </button>
                    ) : (
                      <button className={styles.packageBtn}
                        disabled={buying === p.id}
                        onClick={() => startCheckout(p)}>
                        {buying === p.id ? '準備中…' : '購入する'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <p className={styles.hint}>
              ※ 購入したポイントに有効期限はありません。決済はStripeの安全な画面で行われ、
              カード情報が当サイトに保存されることはありません。
              購入後の返金は、法令で定められた場合を除きお受けできません。
            </p>
            {/* 特定商取引法に基づく表記への導線。
                購入手続きの前に確認できる位置に置く必要があるため、購入ボタンと同じ枠内に置いています。 */}
            <p className={styles.hint}>
              <a href="/tokushoho" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>
                特定商取引法に基づく表記
              </a>
            </p>
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
                      <span className={styles.ledgerType}>{formatLedgerEntry(e, featureLabels)}</span>
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

      {/* 役の一覧。絵柄の見本を並べて、どうそろえばよいかを示す。 */}
      {showHands && (
        <div className={styles.handOverlay} onClick={() => setShowHands(false)}>
          <div className={styles.handModal} onClick={e => e.stopPropagation()}>
            <button className={styles.handClose} onClick={() => setShowHands(false)} aria-label="閉じる">✕</button>
            <h2 className={styles.handTitle}>🎴 絵柄のそろい方（役）</h2>
            <p className={styles.handLead}>
              スタンプの絵柄は、そのカードで使う{STAMP_ICONS.length > 5 ? 5 : STAMP_ICONS.length}種類から毎日1つ引かれます。
              {stampDays}個そろったとき、並び方に応じて追加のポイントがもらえます。
            </p>

            <ul className={styles.handList}>
              {HAND_ORDER.map(key => {
                const info = HANDS[key]
                const pts = handPoints[key] ?? 0
                return (
                  <li key={key} className={styles.handRow}>
                    <div className={styles.handSample}>
                      {HAND_SAMPLES[key].map((n, i) => (
                        <img key={i} src={STAMP_ICONS[n].src} alt=""
                          className={styles.handSampleIcon}/>
                      ))}
                    </div>
                    <div className={styles.handInfo}>
                      <span className={styles.handName}>
                        {info.label}
                        {pts > 0
                          ? <span className={styles.handPt}>+{pts}pt</span>
                          : <span className={styles.handPtNone}>おまけなし</span>}
                      </span>
                      <span className={styles.handNote}>
                        {info.note}・約{HAND_ODDS[key] < 1
                          ? Math.round(100 / HAND_ODDS[key])
                          : Math.round(100 / HAND_ODDS[key])}枚に1回
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            <p className={styles.handFoot}>
              ※ 絵柄の見本です。実際に使われる絵柄はカードごとに変わります。
              いずれの役にもならなかった場合、達成ボーナスの{stampBonus}ptのみとなります。
            </p>
            <button className={styles.handOk} onClick={() => setShowHands(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}
