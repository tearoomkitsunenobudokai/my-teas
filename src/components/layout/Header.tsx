'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { resizeImage } from '@/lib/resizeImage'
import { checkProfileFields } from '@/lib/moderation'
import styles from './Header.module.css'

const AREAS = [
  '北海道・東北エリア','関東・甲信越エリア','首都圏エリア',
  '東海・北陸エリア','近畿エリア','中国・四国エリア','九州・沖縄エリア',
]

const PREFECTURES: Record<string, string[]> = {
  '北海道・東北エリア': ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県'],
  '関東・甲信越エリア': ['茨城県','栃木県','群馬県','埼玉県','千葉県','神奈川県','山梨県','長野県','新潟県'],
  '首都圏エリア':       ['東京都'],
  '東海・北陸エリア':   ['静岡県','愛知県','岐阜県','三重県','富山県','石川県','福井県'],
  '近畿エリア':         ['滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県'],
  '中国・四国エリア':   ['鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県'],
  '九州・沖縄エリア':   ['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'],
}

function hexToRgba(hex: string, a = 0.72): string {
  const h = (hex ?? '').replace('#', '')
  if (h.length >= 6) {
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
  }
  return `rgba(200,169,110,${a})`
}

function TeaCupTiny({ color, size = 32 }: { color?: string; size?: number }) {
  const c = color ?? '#C8A96EB0'
  const rgba = hexToRgba(c, 0.75)
  const id = 'hc' + c.replace(/[^a-zA-Z0-9]/g,'').slice(0,8)
  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      <ellipse cx="60" cy="60" rx="52" ry="52" fill="#f5f0ea" stroke="#d8cfc4" strokeWidth="2"/>
      <ellipse cx="60" cy="60" rx="44" ry="44" fill="#ede8e0"/>
      <ellipse cx="60" cy="60" rx="38" ry="38" fill={rgba}/>
      <defs>
        <radialGradient id={id} cx="38%" cy="38%" r="55%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="60" rx="38" ry="38" fill={`url(#${id})`}/>
      <ellipse cx="48" cy="48" rx="8" ry="4" fill="white" opacity="0.3" transform="rotate(-20 48 48)"/>
    </svg>
  )
}

export default function Header({ profile: initialProfile }: { profile: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  // certified_count は shop_visits テーブルから自動集計（手動入力は廃止）
  const [stats, setStats] = useState({ review_count: 0, tea_count: 0, certified_count: 0 })
  const [form, setForm] = useState({
    name: initialProfile?.name ?? '',
    bio: initialProfile?.bio ?? '',
    favorite_tea: initialProfile?.favorite_tea ?? '',
    location_area: initialProfile?.location_area ?? '',
    location_prefecture: initialProfile?.location_prefecture ?? '',
    location_visibility: initialProfile?.location_visibility ?? 'area',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setEditing(false) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ログイン不可（login_disabled）ユーザーを強制サインアウトする
  // ※ Supabase Authレベルでのログイン拒否ではなく、アプリ側でのチェックです。
  //   より厳密にブロックしたい場合はSupabaseのAuth Hook等の導入を推奨します。
  useEffect(() => {
    if (!initialProfile?.id) return
    ;(async () => {
      const { data: p } = await supabase.from('profiles')
        .select('account_status,is_admin,is_creator').eq('id', initialProfile.id).single()
      if (p && p.account_status === 'login_disabled' && !p.is_admin && !p.is_creator) {
        await supabase.auth.signOut()
        alert('このアカウントは現在ログインが制限されています。心当たりがない場合は管理者にお問い合わせください。')
        router.push('/auth')
      }
    })()
  }, [initialProfile?.id, supabase, router])

  useEffect(() => {
    if (!open || !initialProfile?.id) return
    ;(async () => {
      const [{ data: r }, { count: visitCount }] = await Promise.all([
        supabase.from('reviews').select('id, tea_name, is_public').eq('user_id', initialProfile.id),
        supabase.from('shop_visits').select('id', { count: 'exact', head: true }).eq('user_id', initialProfile.id),
      ])
      setStats({
        review_count: r?.length ?? 0,
        tea_count: new Set(r?.map((x:any) => x.tea_name)).size,
        certified_count: visitCount ?? 0,
      })
    })()
  }, [open, initialProfile?.id, supabase])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  async function saveProfile() {
    if (!initialProfile?.id) {
      alert('プロフィール情報の取得に失敗しているため保存できません。ページを再読み込みしてください。')
      return
    }
    // 不適切な表現のチェック（名前・自己紹介・お気に入りの紅茶）
    const check = checkProfileFields([
      { label: 'お名前', value: form.name },
      { label: '自己紹介', value: form.bio },
      { label: 'お気に入りの紅茶', value: form.favorite_tea },
    ])
    if (!check.clean) {
      alert(`「${check.label}」に不適切な表現が含まれている可能性があります。内容を見直してください。`)
      return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      bio: form.bio || null,
      favorite_tea: form.favorite_tea || null,
      location_area: form.location_area || null,
      location_prefecture: form.location_prefecture || null,
      location_visibility: form.location_visibility,
    }
    await supabase.from('profiles').update(payload).eq('id', initialProfile.id)
    setProfile((p: any) => ({ ...p, ...payload }))
    setSaving(false)
    setEditing(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !initialProfile?.id) return
    if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください'); return }
    setUploading(true)
    try {
      const blob = await resizeImage(file)
      // 同じユーザーは常に同じパスに上書き保存（古い画像が溜まらない）。
      // キャッシュ回避のため保存後のURLにタイムスタンプを付与する。
      const path = `${initialProfile.id}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) { alert('アップロードに失敗しました: ' + upErr.message); setUploading(false); return }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`

      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', initialProfile.id)
      if (dbErr) { alert('保存に失敗しました: ' + dbErr.message); setUploading(false); return }

      setProfile((p: any) => ({ ...p, avatar_url: url }))
    } catch (err: any) {
      alert(err?.message ?? '画像の処理に失敗しました')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const initial = (profile?.name ?? '?').charAt(0).toUpperCase()

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🍵</span>
        TeaNote
      </div>
      <div className={styles.right} ref={panelRef}>
        <button className={styles.avatarBtn} onClick={() => { setOpen(v => !v); setEditing(false) }}>
          <div className={styles.avatar}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className={styles.avatarImg} />
              : initial}
          </div>
        </button>
        <button className={styles.myPageBtn} onClick={() => { setOpen(v => !v); setEditing(false) }}>
          マイページ
        </button>

        {open && (
          <div className={styles.panel}>
            {/* パネルヘッダー */}
            <div className={styles.panelHeader}>
              <div className={styles.panelAvatar}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className={styles.avatarImg} />
                  : initial}
              </div>
              <div className={styles.panelNameWrap}>
                <p className={styles.panelName}>{profile?.name}</p>
                {profile?.location_visibility !== 'private' && (profile?.location_area || profile?.location_prefecture) && (
                  <p className={styles.panelLocation}>
                    📍 {profile.location_visibility === 'prefecture' && profile.location_prefecture
                        ? `${profile.location_prefecture}（${profile.location_area ?? ''}）`
                        : profile.location_area ?? ''}
                  </p>
                )}
              </div>
            </div>

            {!editing ? (
              <>
                {/* 統計 */}
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{stats.review_count}</span>
                    <span className={styles.statLabel}>評価数</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{stats.tea_count}</span>
                    <span className={styles.statLabel}>茶葉数</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{stats.certified_count}</span>
                    <span className={styles.statLabel}>認定店制覇</span>
                  </div>
                </div>
                <p className={styles.autoCalcNote}>
                  ※ 認定店制覇数は「認定店」タブの訪問済みチェックから自動集計されます
                </p>

                {/* AI分析用ポイント（自分だけに表示。他ユーザーには非公開） */}
                <Link href="/dashboard/points" className={styles.pointsBadge} onClick={() => setOpen(false)}>
                  <span className={styles.pointsIcon}>💎</span>
                  <span className={styles.pointsNum}>{profile?.points ?? 0}</span>
                  <span className={styles.pointsLabel}>pt（AI分析で消費）→</span>
                </Link>

                {/* お気に入りの紅茶 */}
                {profile?.favorite_tea && (
                  <div className={styles.favSection}>
                    <p className={styles.favLabel}>☕ お気に入りの紅茶</p>
                    <div className={styles.favTea}>
                      <span className={styles.favTeaName}>{profile.favorite_tea}</span>
                    </div>
                  </div>
                )}

                {/* 自己紹介 */}
                {profile?.bio && (
                  <div className={styles.bioSection}>
                    <p className={styles.bioText}>{profile.bio}</p>
                  </div>
                )}

                <div className={styles.panelActions}>
                  <button className={styles.editBtn} disabled={!initialProfile?.id} onClick={() => {
                    setForm({
                      name: profile?.name ?? '',
                      bio: profile?.bio ?? '',
                      favorite_tea: profile?.favorite_tea ?? '',
                      location_area: profile?.location_area ?? '',
                      location_prefecture: profile?.location_prefecture ?? '',
                      location_visibility: profile?.location_visibility ?? 'area',
                    })
                    setEditing(true)
                  }}>✏️ プロフィールを編集</button>
                  <button className={styles.logoutBtn} onClick={logout}>ログアウト</button>
                </div>
              </>
            ) : (
              /* 編集フォーム（certified_count の入力欄は削除済み） */
              <div className={styles.editForm}>
                <label className={styles.eLabel}>プロフィール画像</label>
                <div className={styles.avatarEditRow}>
                  <div className={styles.avatarPreview}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className={styles.avatarImg} />
                      : initial}
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                    <button type="button" className={styles.avatarUploadBtn} disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}>
                      {uploading ? 'アップロード中...' : '画像を選択'}
                    </button>
                    <p className={styles.avatarHint}>正方形にトリミングされ、小さく圧縮されます</p>
                  </div>
                </div>

                <label className={styles.eLabel}>お名前</label>
                <input className={styles.eInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="お名前"/>

                <label className={styles.eLabel}>居住地・活動エリア</label>
                <select className={styles.eInput} value={form.location_area}
                  onChange={e => setForm(f => ({ ...f, location_area: e.target.value, location_prefecture: '' }))}>
                  <option value="">エリアを選択…</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {form.location_area && (
                  <select className={styles.eInput} value={form.location_prefecture}
                    onChange={e => setForm(f => ({ ...f, location_prefecture: e.target.value }))}>
                    <option value="">都道府県（任意）</option>
                    {(PREFECTURES[form.location_area] ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                <select className={styles.eInput} value={form.location_visibility}
                  onChange={e => setForm(f => ({ ...f, location_visibility: e.target.value }))}>
                  <option value="area">エリアまで公開</option>
                  <option value="prefecture">都道府県まで公開</option>
                  <option value="private">非公開</option>
                </select>

                <label className={styles.eLabel}>自己紹介</label>
                <textarea className={styles.eInput} rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="紅茶の好みや活動など…"/>

                <label className={styles.eLabel}>お気に入りの紅茶</label>
                <input className={styles.eInput} value={form.favorite_tea}
                  onChange={e => setForm(f => ({ ...f, favorite_tea: e.target.value }))}
                  placeholder="例: ダージリン・ファーストフラッシュ"/>

                <div className={styles.editActions}>
                  <button className={styles.cancelSmBtn} onClick={() => setEditing(false)}>キャンセル</button>
                  <button className={styles.saveSmBtn} onClick={saveProfile} disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
