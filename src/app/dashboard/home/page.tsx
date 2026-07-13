'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import styles from './home.module.css'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// パートナーごとのSNSボタン（未設定はグレーアウトしてクリック不可）
function PartnerSns({ partner }: { partner: any }) {
  const items = [
    { key: 'x', label: 'X', icon: '𝕏', url: partner.sns_x_url },
    { key: 'ig', label: 'Instagram', icon: '📷', url: partner.sns_instagram_url },
    { key: 'other', label: partner.sns_other_label || 'その他', icon: '🔗', url: partner.sns_other_url },
  ]
  return (
    <div className={styles.snsRow}>
      {items.map(s => (
        s.url ? (
          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
            className={styles.snsChip} title={s.label}>
            <span className={styles.snsIcon}>{s.icon}</span>{s.label}
          </a>
        ) : (
          <span key={s.key} className={`${styles.snsChip} ${styles.snsChipOff}`} aria-disabled="true">
            <span className={styles.snsIcon}>{s.icon}</span>{s.label}
          </span>
        )
      ))}
    </div>
  )
}

export default function HomePage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      const now = new Date().toISOString()
      const [{ data: profile }, { data: ann }, { data: links }] = await Promise.all([
        user ? supabase.from('profiles').select('name').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('announcements').select('*').eq('is_active', true)
          .lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gte.${now}`)
          .order('published_at', { ascending: false }),
        supabase.from('home_links').select('*').eq('kind', 'ad').eq('is_active', true).order('sort_order'),
      ])
      setName(profile?.name ?? '')
      setAnnouncements(ann ?? [])
      // 掲載期間内のパートナーのみ表示
      setPartners((links ?? []).filter(l =>
        (!l.start_at || l.start_at <= now) && (!l.end_at || l.end_at >= now)
      ))
      setLoading(false)
    })()
  }, [supabase])

  return (
    <div className={styles.wrap}>
      {/* ヒーロー */}
      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>MY-TEAS</span>
        <h1 className={styles.heroTitle}>
          {name ? `おかえりなさい、${name}さん` : 'ようこそ'}
        </h1>
        <p className={styles.heroLead}>今日の一杯を、記録に。</p>
        <div className={styles.heroBtnRow}>
          <Link href="/dashboard/reviews?new=1" className={styles.btnPrimary}>
            🍵 お茶を評価する
          </Link>
          <Link href="/dashboard/certified-shops" className={styles.btnGhost}>
            🏪 紅茶の美味しいお店を探す
          </Link>
        </div>
      </section>

      {/* お知らせ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>お知らせ</h2>
          <span className={styles.rule}/>
        </div>
        {loading ? (
          <p className={styles.hint}>読み込み中…</p>
        ) : announcements.length === 0 ? (
          <p className={styles.hint}>現在お知らせはありません。</p>
        ) : (
          <div className={styles.announceList}>
            {announcements.map(a => (
              <article key={a.id} className={styles.announceItem}>
                <time className={styles.announceDate}>{fmtDate(a.published_at)}</time>
                <div className={styles.announceMain}>
                  <h3 className={styles.announceTitle}>{a.title}</h3>
                  {a.body && <p className={styles.announceBody}>{a.body}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* My-Teasパートナー */}
      {partners.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>My-Teasパートナー</h2>
            <span className={styles.rule}/>
          </div>
          <div className={styles.partnerGrid}>
            {partners.map(p => (
              <div key={p.id} className={styles.partnerCard}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className={styles.partnerBanner}>
                  {p.image_url
                    ? <img src={p.image_url} alt={p.label} className={styles.partnerImg}/>
                    : <span className={styles.partnerLabel}>{p.label}</span>}
                </a>
                <div className={styles.partnerFoot}>
                  <span className={styles.partnerName}>{p.label}</span>
                  <PartnerSns partner={p}/>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
