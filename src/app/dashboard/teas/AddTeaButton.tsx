'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './AddTeaButton.module.css'

export default function AddTeaButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', origin: '', category: 'black', description: '' })
  const router = useRouter()
  const supabase = createClient()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.name) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('teas').insert({ ...form, created_by: user?.id, is_official: false })
    setLoading(false)
    setOpen(false)
    setForm({ name: '', origin: '', category: 'black', description: '' })
    router.refresh()
  }

  return (
    <>
      <button className={styles.btn} onClick={() => setOpen(true)}>+ 茶葉を追加</button>
      {open && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>茶葉を登録</h2>
            <label className={styles.label}>茶葉の名前 *</label>
            <input className={styles.input} value={form.name} onChange={set('name')} placeholder="例: ダージリン ファーストフラッシュ" />
            <label className={styles.label}>産地・ブランド</label>
            <input className={styles.input} value={form.origin} onChange={set('origin')} placeholder="例: インド・ダージリン地方" />
            <label className={styles.label}>カテゴリ</label>
            <select className={styles.input} value={form.category} onChange={set('category')}>
              <option value="black">紅茶 (Black Tea)</option>
              <option value="green">緑茶 (Green Tea)</option>
              <option value="oolong">烏龍茶 (Oolong)</option>
              <option value="white">白茶 (White Tea)</option>
              <option value="herbal">ハーブティー (Herbal)</option>
            </select>
            <label className={styles.label}>説明</label>
            <textarea className={styles.input} value={form.description} onChange={set('description')} placeholder="この茶葉の特徴…" rows={3} />
            <div className={styles.footer}>
              <button className={styles.cancel} onClick={() => setOpen(false)}>キャンセル</button>
              <button className={styles.save} onClick={save} disabled={loading}>{loading ? '登録中...' : '登録'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
