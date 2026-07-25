'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import styles from './maintenance.module.css'

export default function MaintenancePage() {
  const supabase = createClient()
  const [message, setMessage] = useState('')
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => {
    (async () => {
      // メンテナンス中のメッセージを取得（未ログインでも参照できる関数）
      const { data } = await supabase.rpc('get_maintenance_message')
      if (typeof data === 'string' && data) setMessage(data)

      // 全面停止中は、ログイン中のユーザーを強制的にログアウトさせる。
      // （この画面に飛ばされている＝製作者・管理者ではないため）
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.signOut()
        setLoggedOut(true)
      }
    })()
  }, [supabase])

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.icon}>🍵</span>
        <h1 className={styles.title}>メンテナンス中</h1>
        <p className={styles.message}>
          {message || 'ただいまメンテナンス中です。しばらく経ってから再度お試しください。'}
        </p>
        {loggedOut && (
          <p className={styles.note}>
            メンテナンスのため、いったんログアウトしました。
            作業が終わりましたら、再度ログインしてご利用ください。
          </p>
        )}
        <p className={styles.sub}>
          記録済みの評価データは保持されています。ご不便をおかけしますが、少しお待ちください。
        </p>
        <a href="/auth" className={styles.btn}>ログイン画面へ</a>
      </div>
    </div>
  )
}
