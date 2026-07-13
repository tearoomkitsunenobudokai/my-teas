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
  const [sns, setSns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profile }, { data: ann }, { data: links }] = await Promise.all([
        user ? supabase.from('profiles').select('name').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('announcements').select('*').eq('is_active', true).order('sort_order').order('created_at', { ascending: false }),
        supabase.from('home_links').select('*').eq('is_active', true).order('sort_order'),
      ])
      setName(profile?.name ?? '')
      setAnnouncements(ann ?? [])
      setAds((links ?? []).filter(l => l.kind === 'ad'))
      setSns((links ?? []).filter(l => l.kind === 'sns'))
      setLoading(false)
    })()
  }, [supabase])

  return (
    <div className={styles.wrap}>
      {/* 挨拶 */}
      <p className={styles.greeting}>{name ? `おかえりなさい、${name}さん` : 'ようこそ'}</p>

      {/* メインCTA */}
      <section className={styles.hero}>
        <p className={styles.heroLead}>今日飲んだ紅茶を記録しませんか？</p>
        <Link href="/dashboard/reviews?new=1" className={styles.heroBtn}>
          🍵 お茶を評価する
        </Link>
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
                  <span className={styles.announceDate}>{fmtDate(a.created_at)}</span>
                </div>
                {a.body && <p className={styles.announceBody}>{a.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 広告掲載欄 */}
      {ads.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎗 スポンサー</h2>
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

      {/* SNSリンク */}
      {sns.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🔗 公式リンク</h2>
          <div className={styles.snsRow}>
            {sns.map(s => (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.snsChip}>
                {s.icon && <span>{s.icon}</span>} {s.label}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
