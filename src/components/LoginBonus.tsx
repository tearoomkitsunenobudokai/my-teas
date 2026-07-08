'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

// アプリ（ダッシュボード）を開いたときに1回だけログインを記録し、
// ログインボーナスが付与されたらトーストで知らせる。
// 付与判定・重複防止はサーバー側(record_login_and_grant)で行う。
export default function LoginBonus() {
  const [granted, setGranted] = useState<number | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return   // Strict Mode等での二重実行を防ぐ
    ran.current = true
    const supabase = createClient()
    supabase.rpc('record_login_and_grant').then(({ data }) => {
      if (typeof data === 'number' && data > 0) {
        setGranted(data)
        setTimeout(() => setGranted(null), 5000)
      }
    })
  }, [])

  if (!granted) return null
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#1D9E75', color: '#fff', padding: '12px 20px', borderRadius: 10,
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)', zIndex: 1000, fontSize: 14, fontWeight: 600,
    }}>
      🎉 ログインボーナス！ {granted}ポイントを獲得しました
    </div>
  )
}
