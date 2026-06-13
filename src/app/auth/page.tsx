'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './auth.module.css'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })
    if (error) { setError('メールアドレスまたはパスワードが違います'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleSignup() {
    if (!form.name) { setError('お名前を入力してください'); return }
    if (form.password.length < 8) { setError('パスワードは8文字以上にしてください'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setError('')
    alert('確認メールを送信しました。メールを確認してからログインしてください。')
    setTab('login')
    setLoading(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🍵</span>
          TeaNote
        </div>
        <p className={styles.tagline}>紅茶を記録して、共有しよう</p>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); setError('') }}>ログイン</button>
          <button className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => { setTab('signup'); setError('') }}>新規登録</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {tab === 'login' ? (
          <div className={styles.form}>
            <label className={styles.label}>メールアドレス</label>
            <input className={styles.input} type="email" placeholder="tea@example.com" value={form.email} onChange={set('email')} />
            <label className={styles.label}>パスワード</label>
            <input className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button className={styles.btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <label className={styles.label}>お名前</label>
            <input className={styles.input} type="text" placeholder="山田 茶子" value={form.name} onChange={set('name')} />
            <label className={styles.label}>メールアドレス</label>
            <input className={styles.input} type="email" placeholder="tea@example.com" value={form.email} onChange={set('email')} />
            <label className={styles.label}>パスワード（8文字以上）</label>
            <input className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} />
            <button className={styles.btnPrimary} onClick={handleSignup} disabled={loading}>
              {loading ? '登録中...' : 'アカウントを作成'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
