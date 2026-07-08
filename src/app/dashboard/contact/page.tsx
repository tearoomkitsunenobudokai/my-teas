'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import styles from './contact.module.css'

// ─────────────────────────────────────────────────────────
// Googleフォームの設定
//
// ① Googleフォームを作成し、「事前入力したURLを取得」で
//    ユーザーID欄に目印を入れてリンクを取得する。
// ② 生成されたURLから、下記2つを書き換える:
//    - FORM_BASE_URL : フォームの /viewform までのURL
//    - USER_ID_ENTRY : ユーザーID欄の entry.XXXXXXXX の部分
//
// 例: 取得したURLが
//   https://docs.google.com/forms/d/e/ABCDEFG/viewform?usp=pp_url&entry.123456789=__UID__
//   の場合、
//   FORM_BASE_URL = 'https://docs.google.com/forms/d/e/ABCDEFG/viewform'
//   USER_ID_ENTRY = 'entry.123456789'
// ─────────────────────────────────────────────────────────
const FORM_BASE_URL = 'https://docs.google.com/forms/d/e/REPLACE_WITH_YOUR_FORM_ID/viewform'
const USER_ID_ENTRY = 'entry.REPLACE_WITH_YOUR_ENTRY_ID'

export default function ContactPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase])

  const isConfigured =
    !FORM_BASE_URL.includes('REPLACE_WITH') && !USER_ID_ENTRY.includes('REPLACE_WITH')

  // ユーザーIDを事前入力したフォームURLを組み立てる
  const formUrl = userId
    ? `${FORM_BASE_URL}?usp=pp_url&${USER_ID_ENTRY}=${encodeURIComponent(userId)}`
    : FORM_BASE_URL

  async function copyId() {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* クリップボード不可の環境では無視 */ }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>お問い合わせ</h1>
      <p className={styles.lead}>
        バグのご報告、機能のご要望、おすすめの紅茶店の情報などをお寄せください。
      </p>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>お問い合わせの種類</h2>
        <ul className={styles.typeList}>
          <li><span className={styles.badge}>🐛 バグ報告</span> 不具合・エラーのご報告</li>
          <li><span className={styles.badge}>💡 要望</span> 機能のご要望・改善案</li>
          <li><span className={styles.badge}>🍵 おすすめの店</span> 認定店にない、おすすめの紅茶店</li>
        </ul>
      </div>

      {isConfigured ? (
        <>
          <a className={styles.formBtn} href={formUrl} target="_blank" rel="noopener noreferrer">
            お問い合わせフォームを開く
          </a>
          <p className={styles.note}>
            フォームにはあなたのユーザーIDが自動で入力されます（変更しないでください）。
            回答時にどなたからのお問い合わせか確認するために使用します。
          </p>
        </>
      ) : (
        <div className={styles.notReady}>
          <p>お問い合わせフォームは現在準備中です。しばらくお待ちください。</p>
        </div>
      )}

      {userId && (
        <div className={styles.idBox}>
          <span className={styles.idLabel}>あなたのユーザーID</span>
          <code className={styles.idValue}>{userId}</code>
          <button className={styles.copyBtn} onClick={copyId}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <p className={styles.idHint}>
            ※フォームに自動で入りますが、うまく入らない場合はこのIDを本文に貼り付けてください。
          </p>
        </div>
      )}
    </div>
  )
}
