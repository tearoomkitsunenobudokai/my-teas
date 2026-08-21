'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import styles from './contact.module.css'

export default function ContactPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCreator, setIsCreator] = useState(false)

  // DB（app_settings）から取得したフォーム設定
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [entryId, setEntryId] = useState('')

  // 製作者用の編集フォーム（保存前の下書き）
  const [draftUrl, setDraftUrl] = useState('')
  const [draftEntry, setDraftEntry] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null
      setUserId(user?.id ?? null)
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('is_creator').eq('id', user.id).single()
      setIsCreator(profile?.is_creator ?? false)
    })
    supabase.from('app_settings').select('key,value').in('key', ['contact_form_base_url', 'contact_form_entry_id'])
      .then(({ data }) => {
        const m: Record<string, string> = {}
        for (const r of data ?? []) m[r.key] = r.value
        setFormBaseUrl(m['contact_form_base_url'] ?? '')
        setEntryId(m['contact_form_entry_id'] ?? '')
        setDraftUrl(m['contact_form_base_url'] ?? '')
        setDraftEntry(m['contact_form_entry_id'] ?? '')
      })
  }, [supabase])

  const isConfigured = formBaseUrl.trim().length > 0

  // ユーザーIDを事前入力したフォームURLを組み立てる（entry未設定なら素のURLのまま）
  const formUrl = (() => {
    if (!formBaseUrl) return ''
    if (userId && entryId) {
      const sep = formBaseUrl.includes('?') ? '&' : '?'
      return `${formBaseUrl}${sep}usp=pp_url&${entryId}=${encodeURIComponent(userId)}`
    }
    return formBaseUrl
  })()

  async function copyId() {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* クリップボード不可の環境では無視 */ }
  }

  async function saveFormSettings() {
    setSaving(true)
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'contact_form_base_url', value: draftUrl.trim(), updated_at: new Date().toISOString() },
      { key: 'contact_form_entry_id', value: draftEntry.trim(), updated_at: new Date().toISOString() },
    ])
    setSaving(false)
    if (error) { alert('保存に失敗しました: ' + error.message); return }
    setFormBaseUrl(draftUrl.trim())
    setEntryId(draftEntry.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>お問い合わせ</h1>
      <p className={styles.lead}>
        バグのご報告、機能のご要望、おすすめの紅茶店の情報などをお寄せください。
      </p>

      {isCreator && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>🔧 フォームURL設定（製作者のみ表示）</h2>
          <p className={styles.note} style={{ marginBottom: 10 }}>
            GoogleフォームのURLを貼り付けると、下の「お問い合わせフォームを開く」ボタンに反映されます。
            ユーザーIDを自動入力したい場合は、フォームの「事前入力したURLを取得」で得た
            <code style={{ margin: '0 3px' }}>entry.XXXXXXXX</code> を下の欄に入力してください（任意）。
          </p>
          <label className={styles.idLabel} style={{ display: 'block', marginBottom: 4 }}>フォームURL（/viewform まで）</label>
          <input
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: 13, marginBottom: 10 }}
            value={draftUrl} onChange={e => setDraftUrl(e.target.value)}
            placeholder="https://docs.google.com/forms/d/e/xxxxx/viewform"/>
          <label className={styles.idLabel} style={{ display: 'block', marginBottom: 4 }}>ユーザーID欄のentry ID（任意）</label>
          <input
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: 13, marginBottom: 10 }}
            value={draftEntry} onChange={e => setDraftEntry(e.target.value)}
            placeholder="entry.123456789"/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className={styles.copyBtn} onClick={saveFormSettings} disabled={saving}>
              {saving ? '保存中…' : '保存する'}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>
      )}

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
            {entryId
              ? 'フォームにはあなたのユーザーIDが自動で入力されます（変更しないでください）。回答時にどなたからのお問い合わせか確認するために使用します。'
              : '下記の「あなたのユーザーID」をコピーして、フォーム内に貼り付けてください。'}
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
            {entryId
              ? '※フォームに自動で入りますが、うまく入らない場合はこのIDを本文に貼り付けてください。'
              : '※お問い合わせフォーム内で、どなたからのお問い合わせか分かるようこのIDを貼り付けてください。'}
          </p>
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '0.5px solid var(--border)', display: 'flex', gap: 16, fontSize: 13 }}>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>プライバシーポリシー</a>
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>利用規約</a>
        <a href="/tokushoho" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>特定商取引法に基づく表記</a>
      </div>
    </div>
  )
}
