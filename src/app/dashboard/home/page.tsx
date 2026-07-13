'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import styles from './home.module.css'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function HomePage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])
  const [snsX, setSnsX] = useState('')
  const [snsInstagram, setSnsInstagram] = useState('')
  const [snsOther, setSnsOther] = useState('')
  const [snsOtherLabel, setSnsOtherLabel] = useState('その他')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date().toISOString()
      const [{ data: profile }, { data: ann }, { data: links }, { data: settings }] = await Promise.all([
        user ? supabase.from('profiles').select('name').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('announcements').select('*').eq('is_active', true)
          .lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gte.${now}`)
          .order('published_at', { ascending: false }),
        supabase.from('home_links').select('*').eq('kind', 'ad').eq('is_active', true).order('sort_order'),
        supabase.from('app_settings').select('key,value')
          .in('key', ['sns_x_url', 'sns_instagram_url', 'sns_other_url', 'sns_other_label']),
      ])
      setName(profile?.name ?? '')
      setAnnouncements(ann ?? [])
      // 掲載期間内（開始日時が過去 または 未設定、終了日時が未来 または 未設定）のものだけ表示
      setAds((links ?? []).filter(l =>
        (!l.start_at || l.start_at <= now) && (!l.end_at || l.end_at >= now)
      ))
      const m: Record<string, string> = {}
      for (const r of settings ?? []) m[r.key] = r.value
      setSnsX(m['sns_x_url'] ?? '')
      setSnsInstagram(m['sns_instagram_url'] ?? '')
      setSnsOther(m['sns_other_url'] ?? '')
      setSnsOtherLabel(m['sns_other_label'] || 'その他')
      setLoading(false)
    })()
  }, [supabase])

  const snsItems = [
    { label: 'X', icon: '𝕏', url: snsX },
    { label: 'Instagram', icon: '📷', url: snsInstagram },
    { label: snsOtherLabel, icon: '🔗', url: snsOther },
  ]

  return (
    <div className={styles.wrap}>
      {/* 挨拶 */}
      <p className={styles.greeting}>{name ? `おかえりなさい、${name}さん` : 'ようこそ'}</p>

      {/* メインCTA */}
      <section className={styles.hero}>
        <p className={styles.heroLead}>今日飲んだ紅茶を記録しませんか？</p>
        <div className={styles.heroBtnRow}>
          <Link href="/dashboard/reviews?new=1" className={styles.heroBtn}>
            🍵 お茶を評価する
          </Link>
          <Link href="/dashboard/certified-shops" className={styles.heroBtnSecondary}>
            🏪 紅茶の美味しいお店を探す
          </Link>
        </div>
      </section>

      {/* お知らせ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📣 お知らせ</h2>
        {loading ? (
          <p className={styles.hint}>読み込み中…</p>
        ) : announcements.length === 0 ? (
          <p className={styles.hint}>現在お知らせはありません。</p>
        ) : (
          <div className={styles.announceList}>
            {announcements.map(a => (
              <div key={a.id} className={styles.announceItem}>
                <div className={styles.announceHead}>
                  <span className={styles.announceTitle}>{a.title}</span>
                  <span className={styles.announceDate}>{fmtDate(a.published_at)}</span>
                </div>
                {a.body && <p className={styles.announceBody}>{a.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My-Teasパートナー（広告バナー） */}
      {ads.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎗 My-Teasパートナー</h2>
          <div className={styles.adGrid}>
            {ads.map(ad => (
              <a key={ad.id} href={ad.url} target="_blank" rel="noopener noreferrer" className={styles.adCard}>
                {ad.image_url
                  ? <img src={ad.image_url} alt={ad.label} className={styles.adImg}/>
                  : <span className={styles.adLabel}>{ad.label}</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* SNSリンク（X / Instagram / その他 固定枠。未設定はクリック不可でグレー表示） */}
      <div className={styles.snsRow}>
        {snsItems.map(s => (
          s.url ? (
            <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.snsChip}>
              <span>{s.icon}</span> {s.label}
            </a>
          ) : (
            <span key={s.label} className={`${styles.snsChip} ${styles.snsChipDisabled}`} aria-disabled="true">
              <span>{s.icon}</span> {s.label}
            </span>
          )
        ))}
      </div>
    </div>
  )
}
