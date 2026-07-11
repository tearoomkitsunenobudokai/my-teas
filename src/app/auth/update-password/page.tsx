'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from '../auth.module.css'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const [validLink, setValidLink] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })

  // メールのリンクから来ると、Supabaseが recovery セッションを張る。
  // そのセッションが有効なときだけパスワード変更を許可する。
  useEffect(() => {
    let mounted = true
    // onAuthStateChange の PASSWORD_RECOVERY イベント、または既存セッションで判定
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) { setValidLink(true); setReady(true) }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) setValidLink(true)
      setReady(true)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [supabase])

  async function handleUpdate() {
    if (form.password.length < 8) { setError('パスワードは8文字以上にしてください'); return }
    if (form.password !== form.confirm) { setError('確認用パスワードが一致しません'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true); setLoading(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🍵</span>
          My-Teas
        </div>
        <p className={styles.tagline}>新しいパスワードの設定</p>

        {error && <div className={styles.error}>{error}</div>}

        {!ready ? (
          <p className={styles.tagline}>確認中...</p>
        ) : done ? (
          <div className={styles.form}>
            <p className={styles.tagline} style={{ marginBottom: 8 }}>
              パスワードを変更しました。新しいパスワードでログインしてください。
            </p>
            <button className={styles.btnPrimary} onClick={() => router.push('/auth')}>
              ログイン画面へ
            </button>
          </div>
        ) : !validLink ? (
          <div className={styles.form}>
            <p className={styles.tagline} style={{ marginBottom: 8 }}>
              リンクの有効期限が切れているか、無効です。お手数ですが、もう一度パスワード再設定をやり直してください。
            </p>
            <button className={styles.btnPrimary} onClick={() => router.push('/auth')}>
              ログイン画面へ
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <label className={styles.label}>新しいパスワード（8文字以上）</label>
            <input className={styles.input} type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <label className={styles.label}>新しいパスワード（確認）</label>
            <input className={styles.input} type="password" placeholder="••••••••" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
            <button className={styles.btnPrimary} onClick={handleUpdate} disabled={loading}>
              {loading ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
