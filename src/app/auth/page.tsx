'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './auth.module.css'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  // ログイン画面に出す告知類（未ログインでも取得できる関数を使う）
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [maintMode, setMaintMode] = useState<string>('off')
  const [maintMessage, setMaintMessage] = useState('')
  const [signupEnabled, setSignupEnabled] = useState(true)
  const [signupClosedMessage, setSignupClosedMessage] = useState('')

  useEffect(() => {
    (async () => {
      const [ann, mode, msg, canSignup, closedMsg] = await Promise.all([
        supabase.rpc('get_public_announcements'),
        supabase.rpc('get_maintenance_mode'),
        supabase.rpc('get_maintenance_message'),
        supabase.rpc('is_signup_enabled'),
        supabase.rpc('get_signup_closed_message'),
      ])
      setAnnouncements(ann.data ?? [])
      if (typeof mode.data === 'string') setMaintMode(mode.data)
      if (typeof msg.data === 'string') setMaintMessage(msg.data)
      if (typeof canSignup.data === 'boolean') {
        setSignupEnabled(canSignup.data)
        if (!canSignup.data) setTab('login')
      }
      if (typeof closedMsg.data === 'string') setSignupClosedMessage(closedMsg.data)
    })()
  }, [supabase])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleResetRequest() {
    if (!form.email) { setError('メールアドレスを入力してください'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    // メールアドレスの存在有無を攻撃者に伝えないため、成否に関わらず同じ表示にする
    setResetSent(true)
    setLoading(false)
  }

  async function handleLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    })
    if (error) { setError('メールアドレスまたはパスワードが違います'); setLoading(false); return }
    router.push('/dashboard/home')
  }

  async function handleSignup() {
    if (!form.name) { setError('お名前を入力してください'); return }
    if (form.password.length < 8) { setError('パスワードは8文字以上にしてください'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name },
        /* 確認メールのリンク先。指定しないと Supabase の Site URL
           （既定では localhost）が使われ、メールのリンクが開けなくなる。
           実際にアクセスしているドメインを渡すことで、本番・開発のどちらでも正しく戻れる。 */
        emailRedirectTo: `${window.location.origin}/auth`,
      },
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
          My-Teas
        </div>
        <p className={styles.tagline}>紅茶を記録して、共有しよう</p>

        {/* メンテナンス告知 */}
        {maintMode !== 'off' && (
          <div className={styles.noticeWarn}>
            <strong>🔧 メンテナンス{maintMode === 'full' ? '中（サービス停止中）' : '中（閲覧のみ）'}</strong>
            <p>{maintMessage || 'ただいまメンテナンス中です。しばらく経ってから再度お試しください。'}</p>
          </div>
        )}

        {/* 新規登録の停止告知 */}
        {!signupEnabled && (
          <div className={styles.noticeInfo}>
            <strong>新規登録を停止しています</strong>
            <p>{signupClosedMessage || 'ただいま新規登録を停止しています。再開までしばらくお待ちください。'}</p>
          </div>
        )}

        {!resetMode && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); setError('') }}>ログイン</button>
            {signupEnabled && (
              <button className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => { setTab('signup'); setError('') }}>新規登録</button>
            )}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {resetMode ? (
          resetSent ? (
            <div className={styles.form}>
              <p className={styles.tagline} style={{ marginBottom: 8 }}>
                入力されたメールアドレス宛に、パスワード再設定用のリンクを送信しました。メールをご確認ください。
              </p>
              <button className={styles.btnPrimary} onClick={() => { setResetMode(false); setResetSent(false); setError('') }}>
                ログインに戻る
              </button>
            </div>
          ) : (
            <div className={styles.form}>
              <p className={styles.tagline} style={{ marginBottom: 8 }}>
                ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
              </p>
              <label className={styles.label}>メールアドレス</label>
              <input className={styles.input} type="email" placeholder="tea@example.com" value={form.email} onChange={set('email')} onKeyDown={e => e.key === 'Enter' && handleResetRequest()} />
              <button className={styles.btnPrimary} onClick={handleResetRequest} disabled={loading}>
                {loading ? '送信中...' : '再設定リンクを送信'}
              </button>
              <button className={styles.linkBtn} onClick={() => { setResetMode(false); setError('') }}>
                ← ログインに戻る
              </button>
            </div>
          )
        ) : tab === 'login' ? (
          <div className={styles.form}>
            <label className={styles.label}>メールアドレス</label>
            <input className={styles.input} type="email" placeholder="tea@example.com" value={form.email} onChange={set('email')} />
            <label className={styles.label}>パスワード</label>
            <input className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button className={styles.btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <button className={styles.linkBtn} onClick={() => { setResetMode(true); setError('') }}>
              パスワードをお忘れですか？
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
        {announcements.length > 0 && (
          <div className={styles.notices}>
            <p className={styles.noticesTitle}>📣 お知らせ</p>
            {announcements.map((a, i) => (
              <div key={i} className={styles.noticeItem}>
                <time className={styles.noticeDate}>{fmtDate(a.published_at)}</time>
                <div>
                  <p className={styles.noticeItemTitle}>{a.title}</p>
                  {a.body && <p className={styles.noticeItemBody}>{a.body}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-hint)', textAlign: 'center', marginTop: 20 }}>
          ご登録・ご利用により
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>利用規約</a>
          および
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>プライバシーポリシー</a>
          に同意したものとみなされます。
        </p>
      </div>
    </div>
  )
}
