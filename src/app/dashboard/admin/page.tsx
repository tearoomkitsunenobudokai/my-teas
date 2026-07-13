'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { resizeImageKeepAspect } from '@/lib/resizeImage'
import styles from './admin.module.css'

const LIMIT_ROLES: { key: string; label: string }[] = [
  { key: 'general',    label: '一般ユーザー' },
  { key: 'subscribed', label: '課金ユーザー' },
  { key: 'admin',      label: '管理者' },
  { key: 'creator',    label: '製作者' },
]
const LIMIT_FEATURES: { key: string; label: string }[] = [
  { key: 'reviews', label: '評価の登録上限' },
  { key: 'public',  label: 'コミュニティ公開の上限（月間）' },
  { key: 'wants',   label: '「飲みたい」の登録上限' },
]

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [activeTab, setActiveTab] = useState<'aroma'|'settings'|'users'|'points'|'home'>('aroma')
  const [presets, setPresets] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ group_name: '', itemsText: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ group_name: '', itemsText: '' })
  const [saving, setSaving] = useState(false)

  // ホーム設定（お知らせ・広告/SNSリンク）
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [deletedAnnIds, setDeletedAnnIds] = useState<string[]>([])
  const [savingAnn, setSavingAnn] = useState(false)
  const [annSaved, setAnnSaved] = useState(false)
  const [homeLinks, setHomeLinks] = useState<any[]>([])
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([])
  const [savingLinks, setSavingLinks] = useState(false)
  const [linksSaved, setLinksSaved] = useState(false)
  const [uploadingAdId, setUploadingAdId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { data: profile } = await supabase.from('profiles').select('is_admin,is_creator').eq('id', user.id).single()
    if (!profile?.is_admin && !profile?.is_creator) { router.push('/dashboard'); return }
    setIsAdmin(true)
    setIsCreator(profile?.is_creator ?? false)
    const { data } = await supabase.from('aroma_presets').select('*').order('sort_order')
    setPresets(data ?? [])
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  function startEdit(preset: any) {
    setEditingId(preset.id)
    setEditForm({ group_name: preset.group_name, itemsText: (preset.items ?? []).join('、') })
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    const items = editForm.itemsText.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean)
    await supabase.from('aroma_presets').update({ group_name: editForm.group_name, items }).eq('id', editingId)
    setSaving(false); setEditingId(null); load()
  }

  async function addPreset() {
    if (!addForm.group_name.trim()) return
    setSaving(true)
    const items = addForm.itemsText.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean)
    const maxOrder = Math.max(0, ...presets.map(p => p.sort_order ?? 0))
    await supabase.from('aroma_presets').insert({ group_name: addForm.group_name, items, sort_order: maxOrder + 10 })
    setSaving(false); setShowAdd(false); setAddForm({ group_name: '', itemsText: '' }); load()
  }

  async function deletePreset(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('aroma_presets').delete().eq('id', id)
    load()
  }

  async function movePreset(id: string, dir: 'up' | 'down') {
    const idx = presets.findIndex(p => p.id === id)
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= presets.length) return
    const reordered = [...presets]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: (i + 1) * 10 }))
    setPresets(reordered.map((p, i) => ({ ...p, sort_order: (i + 1) * 10 })))
    await Promise.all(updates.map(u => supabase.from('aroma_presets').update({ sort_order: u.sort_order }).eq('id', u.id)))
  }

  // ─── アプリ設定 ──────────────────────────────────
  const [limits, setLimits] = useState<Record<string, number>>({})  // key: `${role}:${feature}`
  const [costs, setCosts] = useState<any[]>([])
  const [savingCosts, setSavingCosts] = useState(false)
  const [costsSaved, setCostsSaved] = useState(false)
  const [pointPolicy, setPointPolicy] = useState({ initial: '5', loginDays: '5', loginPoints: '2' })
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policySaved, setPolicySaved] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [deletedPackageIds, setDeletedPackageIds] = useState<string[]>([])
  const [savingPackages, setSavingPackages] = useState(false)
  const [packagesSaved, setPackagesSaved] = useState(false)

  useEffect(() => {
    supabase.from('feature_costs').select('feature,cost,label,sort_order').order('sort_order')
      .then(({ data }) => setCosts(data ?? []))
    supabase.from('point_packages').select('*').order('sort_order')
      .then(({ data }) => setPackages(data ?? []))
    supabase.from('announcements').select('*').order('sort_order')
      .then(({ data }) => setAnnouncements(data ?? []))
    supabase.from('home_links').select('*').order('sort_order')
      .then(({ data }) => setHomeLinks(data ?? []))
    supabase.from('app_settings').select('key,value')
      .in('key', ['points_initial', 'login_bonus_days', 'login_bonus_points'])
      .then(({ data }) => {
        const m: any = {}
        for (const r of data ?? []) m[r.key] = r.value
        setPointPolicy({
          initial: m['points_initial'] ?? '5',
          loginDays: m['login_bonus_days'] ?? '5',
          loginPoints: m['login_bonus_points'] ?? '2',
        })
      })
  }, [supabase])

  async function savePointPolicy() {
    setSavingPolicy(true)
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'points_initial', value: pointPolicy.initial, updated_at: new Date().toISOString() },
      { key: 'login_bonus_days', value: pointPolicy.loginDays, updated_at: new Date().toISOString() },
      { key: 'login_bonus_points', value: pointPolicy.loginPoints, updated_at: new Date().toISOString() },
    ])
    setSavingPolicy(false)
    if (error) { alert(error.message); return }
    setPolicySaved(true); setTimeout(() => setPolicySaved(false), 2000)
  }

  function addPackageRow() {
    setPackages(prev => [...prev, {
      id: crypto.randomUUID(), label: '新しいプラン', points: 10, price_yen: 500,
      sort_order: prev.length + 1, is_limited: false, limited_until: null, is_active: true, _new: true,
    }])
  }

  function removePackageRow(id: string, isNew: boolean) {
    setPackages(prev => prev.filter(p => p.id !== id))
    if (!isNew) setDeletedPackageIds(prev => [...prev, id])
  }

  async function savePackages() {
    setSavingPackages(true)
    // 全行が常にidを持つ状態でまとめて送る（idの有無が混在すると
    // PostgRESTがNULLを明示送信してNOT NULL制約に違反するため）
    const rows = packages.map(p => ({
      id: p.id, label: p.label, points: p.points, price_yen: p.price_yen,
      sort_order: p.sort_order, is_limited: p.is_limited,
      limited_until: p.is_limited ? p.limited_until : null,
      is_active: p.is_active, updated_at: new Date().toISOString(),
    }))
    const [{ error: upsertErr }] = await Promise.all([
      supabase.from('point_packages').upsert(rows),
      deletedPackageIds.length
        ? supabase.from('point_packages').delete().in('id', deletedPackageIds)
        : Promise.resolve({ error: null }),
    ])
    setSavingPackages(false)
    if (upsertErr) { alert(upsertErr.message); return }
    setDeletedPackageIds([])
    // 保存後に再取得してDB生成のIDを反映
    const { data } = await supabase.from('point_packages').select('*').order('sort_order')
    setPackages(data ?? [])
    setPackagesSaved(true); setTimeout(() => setPackagesSaved(false), 2000)
  }

  // ── お知らせ ──
  function addAnnRow() {
    setAnnouncements(prev => [...prev, {
      id: crypto.randomUUID(), title: '', body: '', sort_order: prev.length + 1, is_active: true,
      published_at: new Date().toISOString(), expires_at: null, _new: true,
    }])
  }
  function removeAnnRow(id: string, isNew: boolean) {
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    if (!isNew) setDeletedAnnIds(prev => [...prev, id])
  }
  async function saveAnnouncements() {
    setSavingAnn(true)
    const rows = announcements.map(a => ({
      id: a.id, title: a.title, body: a.body || null, sort_order: a.sort_order,
      is_active: a.is_active, published_at: a.published_at, expires_at: a.expires_at || null,
      updated_at: new Date().toISOString(),
    }))
    const [{ error }] = await Promise.all([
      supabase.from('announcements').upsert(rows),
      deletedAnnIds.length ? supabase.from('announcements').delete().in('id', deletedAnnIds) : Promise.resolve({ error: null }),
    ])
    setSavingAnn(false)
    if (error) { alert(error.message); return }
    setDeletedAnnIds([])
    const { data } = await supabase.from('announcements').select('*').order('sort_order')
    setAnnouncements(data ?? [])
    setAnnSaved(true); setTimeout(() => setAnnSaved(false), 2000)
  }

  // ── 広告掲載欄・SNSリンク ──
  function addAdRow() {
    setHomeLinks(prev => [...prev, {
      id: crypto.randomUUID(), kind: 'ad', label: '', url: '', image_url: null, icon: null,
      start_at: null, end_at: null,
      sns_x_url: '', sns_instagram_url: '', sns_other_url: '', sns_other_label: '',
      sort_order: prev.length + 1, is_active: true, _new: true,
    }])
  }
  function removeLinkRow(id: string, isNew: boolean) {
    setHomeLinks(prev => prev.filter(l => l.id !== id))
    if (!isNew) setDeletedLinkIds(prev => [...prev, id])
  }
  async function saveHomeLinks() {
    setSavingLinks(true)
    const rows = homeLinks.map(l => ({
      id: l.id, kind: l.kind, label: l.label, url: l.url,
      image_url: l.image_url || null, icon: l.icon || null,
      start_at: l.start_at || null, end_at: l.end_at || null,
      sns_x_url: l.sns_x_url || null,
      sns_instagram_url: l.sns_instagram_url || null,
      sns_other_url: l.sns_other_url || null,
      sns_other_label: l.sns_other_label || null,
      sort_order: l.sort_order, is_active: l.is_active, updated_at: new Date().toISOString(),
    }))
    const [{ error }] = await Promise.all([
      supabase.from('home_links').upsert(rows),
      deletedLinkIds.length ? supabase.from('home_links').delete().in('id', deletedLinkIds) : Promise.resolve({ error: null }),
    ])
    setSavingLinks(false)
    if (error) { alert(error.message); return }
    setDeletedLinkIds([])
    const { data } = await supabase.from('home_links').select('*').order('sort_order')
    setHomeLinks(data ?? [])
    setLinksSaved(true); setTimeout(() => setLinksSaved(false), 2000)
  }

  // バナー画像のアップロード（Supabase Storage `home-ads` バケットへ）
  async function uploadAdImage(adId: string, file: File) {
    if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください'); return }
    setUploadingAdId(adId)
    try {
      const blob = await resizeImageKeepAspect(file)
      const path = `${adId}.jpg`
      const { error: upErr } = await supabase.storage.from('home-ads')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) { alert('アップロードに失敗しました: ' + upErr.message); return }
      const { data: pub } = supabase.storage.from('home-ads').getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      setHomeLinks(prev => prev.map(l => l.id === adId ? { ...l, image_url: url } : l))
    } catch (e: any) {
      alert(e?.message ?? '画像の処理に失敗しました')
    } finally {
      setUploadingAdId(null)
    }
  }

  async function saveCosts() {
    setSavingCosts(true)
    const rows = costs.map(c => ({ feature: c.feature, cost: c.cost, label: c.label, sort_order: c.sort_order, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('feature_costs').upsert(rows)
    setSavingCosts(false)
    if (error) { alert(error.message); return }
    setCostsSaved(true); setTimeout(() => setCostsSaved(false), 2000)
  }
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    supabase.from('plan_limits').select('role,feature,max_count')
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const row of data ?? []) map[`${row.role}:${row.feature}`] = row.max_count
        setLimits(map)
      })
  }, [supabase])

  async function saveSettings() {
    setSavingSettings(true)
    const rows = Object.entries(limits).map(([key, max_count]) => {
      const [role, feature] = key.split(':')
      return { role, feature, max_count, updated_at: new Date().toISOString() }
    })
    await supabase.from('plan_limits').upsert(rows)
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000)
  }

  // ─── ユーザー管理 ──────────────────────────────────
  const STATUS_LABEL: Record<string, string> = {
    normal: '通常', write_restricted: '書き込み制限', login_disabled: 'ログイン不可',
  }
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    const [{ data: profiles }, { data: reviews }, { data: visits }, { data: signIns }] = await Promise.all([
      supabase.from('profiles').select('id,name,is_admin,is_creator,is_subscribed,account_status,points,created_at').order('created_at', { ascending: true }),
      supabase.from('reviews').select('user_id,is_public'),
      supabase.from('shop_visits').select('user_id'),
      supabase.rpc('get_users_last_sign_in'),
    ])
    const reviewCount: Record<string, number> = {}
    const publicCount: Record<string, number> = {}
    for (const r of reviews ?? []) {
      reviewCount[r.user_id] = (reviewCount[r.user_id] ?? 0) + 1
      if (r.is_public) publicCount[r.user_id] = (publicCount[r.user_id] ?? 0) + 1
    }
    const visitCount: Record<string, number> = {}
    for (const v of visits ?? []) visitCount[v.user_id] = (visitCount[v.user_id] ?? 0) + 1
    const signInMap: Record<string, string> = {}
    for (const s of signIns ?? []) signInMap[s.id] = s.last_sign_in_at

    setUsers((profiles ?? []).map(p => ({
      ...p,
      account_status: p.account_status ?? 'normal',
      reviewCount: reviewCount[p.id] ?? 0,
      publicCount: publicCount[p.id] ?? 0,
      visitCount: visitCount[p.id] ?? 0,
      lastSignInAt: signInMap[p.id] ?? null,
    })))
    setLoadingUsers(false)
    setUsersLoaded(true)
  }, [supabase])

  useEffect(() => {
    if (activeTab === 'users' && !usersLoaded) loadUsers()
  }, [activeTab, usersLoaded, loadUsers])

  async function updateAccountStatus(userId: string, status: string) {
    setUpdatingUserId(userId)
    const { error } = await supabase.rpc('admin_set_account_status', { p_user_id: userId, p_status: status })
    if (error) { alert(error.message); setUpdatingUserId(null); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: status } : u))
    setUpdatingUserId(null)
  }

  async function updateRole(userId: string, role: 'user' | 'subscribed' | 'admin') {
    setUpdatingUserId(userId)
    const newIsAdmin = role === 'admin'
    const newIsSubscribed = role === 'subscribed'
    // 管理者フラグは直接更新、課金フラグは保護ガードがあるため専用RPCで更新する
    const { error: e1 } = await supabase.from('profiles').update({ is_admin: newIsAdmin }).eq('id', userId)
    if (e1) { alert(e1.message); setUpdatingUserId(null); return }
    const { error: e2 } = await supabase.rpc('admin_set_subscription', { p_user_id: userId, p_subscribed: newIsSubscribed })
    if (e2) { alert(e2.message); setUpdatingUserId(null); return }
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, is_admin: newIsAdmin, is_subscribed: newIsSubscribed }
      : u))
    setUpdatingUserId(null)
  }

  // 現在の区分を求める（優先順位: 管理者 > 課金 > 一般）
  function currentRole(u: any): 'user' | 'subscribed' | 'admin' {
    if (u.is_admin) return 'admin'
    if (u.is_subscribed) return 'subscribed'
    return 'user'
  }

  if (isAdmin === null) return <p className={styles.loading}>読み込み中…</p>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>⚙️ 管理者メニュー</h1>

      {/* タブ */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab==='aroma' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('aroma')}>
          🌸 香り分析プリセット
        </button>
        <button className={`${styles.tab} ${activeTab==='settings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('settings')}>
          ⚙️ アプリ設定
        </button>
        <button className={`${styles.tab} ${activeTab==='users' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('users')}>
          👥 ユーザー管理
        </button>
        <button className={`${styles.tab} ${activeTab==='home' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('home')}>
          🏠 ホーム設定
        </button>
        {isCreator && (
          <button className={`${styles.tab} ${activeTab==='points' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('points')}>
            💎 ポイント設定
          </button>
        )}
      </div>

      {/* ─── 香り分析プリセット管理 ─── */}
      {activeTab === 'aroma' && <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🌸 香り分析プリセット管理</h2>
          <p className={styles.sectionDesc}>
            お茶の評価画面に表示される香りの選択肢を管理します。<br/>
            三井農林「紅茶キャラクターホイール」の9系統構造に準拠しています。
          </p>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>+ グループを追加</button>
        </div>

        {/* 追加フォーム */}
        {showAdd && (
          <div className={styles.editCard}>
            <h3 className={styles.editCardTitle}>新しいグループを追加</h3>
            <label className={styles.label}>グループ名（系統名）</label>
            <input className={styles.input} value={addForm.group_name}
              onChange={e => setAddForm(f => ({ ...f, group_name: e.target.value }))}
              placeholder="例: Floral（フローラル）"/>
            <label className={styles.label}>香り語（読点・カンマ・改行で区切る）</label>
            <textarea className={styles.textarea} rows={4} value={addForm.itemsText}
              onChange={e => setAddForm(f => ({ ...f, itemsText: e.target.value }))}
              placeholder="例: バラ、ジャスミン、スズラン、金木犀"/>
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowAdd(false); setAddForm({ group_name: '', itemsText: '' }) }}>キャンセル</button>
              <button className={styles.saveBtn} onClick={addPreset} disabled={saving || !addForm.group_name.trim()}>
                {saving ? '追加中…' : '追加'}
              </button>
            </div>
          </div>
        )}

        {/* プリセット一覧 */}
        <div className={styles.presetList}>
          {presets.map((preset, idx) => (
            <div key={preset.id} className={styles.presetCard}>
              {editingId === preset.id ? (
                /* 編集フォーム */
                <div className={styles.editForm}>
                  <label className={styles.label}>グループ名</label>
                  <input className={styles.input} value={editForm.group_name}
                    onChange={e => setEditForm(f => ({ ...f, group_name: e.target.value }))}/>
                  <label className={styles.label}>香り語（読点・カンマ・改行で区切る）</label>
                  <textarea className={styles.textarea} rows={5} value={editForm.itemsText}
                    onChange={e => setEditForm(f => ({ ...f, itemsText: e.target.value }))}/>
                  <div className={styles.editActions}>
                    <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>キャンセル</button>
                    <button className={styles.saveBtn} onClick={saveEdit} disabled={saving}>
                      {saving ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                /* 表示モード */
                <>
                  <div className={styles.presetHeader}>
                    <div className={styles.presetMoveButtons}>
                      <button className={styles.moveBtn} disabled={idx === 0} onClick={() => movePreset(preset.id, 'up')}>▲</button>
                      <button className={styles.moveBtn} disabled={idx === presets.length - 1} onClick={() => movePreset(preset.id, 'down')}>▼</button>
                    </div>
                    <span className={styles.presetGroupName}>{preset.group_name}</span>
                    <span className={styles.presetCount}>{(preset.items ?? []).length}語</span>
                    <div className={styles.presetActions}>
                      <button className={styles.editBtn} onClick={() => startEdit(preset)}>編集</button>
                      <button className={styles.deleteBtn} onClick={() => deletePreset(preset.id, preset.group_name)}>削除</button>
                    </div>
                  </div>
                  <div className={styles.presetItems}>
                    {(preset.items ?? []).map((item: string) => (
                      <span key={item} className={styles.presetTag}>{item}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>}

      {/* ─── アプリ設定 ─── */}
      {activeTab === 'settings' && <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>⚙️ アプリ設定</h2>
          <p className={styles.sectionDesc}>My-Teasの各種制限・設定を管理します。</p>
        </div>
        <div className={styles.settingsCard}>
          <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
            権限区分ごとに各機能の上限を設定します。<strong>0 は無制限</strong>です。
          </p>
          {LIMIT_FEATURES.map(f => (
            <div key={f.key} className={styles.limitGroup}>
              <p className={styles.limitGroupTitle}>{f.label}</p>
              <div className={styles.limitGrid}>
                {LIMIT_ROLES.map(role => {
                  const key = `${role.key}:${f.key}`
                  return (
                    <div key={key} className={styles.limitCell}>
                      <label className={styles.limitRoleLabel}>{role.label}</label>
                      <div className={styles.settingControl}>
                        <input className={styles.settingInput} type="number" min={0} max={9999}
                          value={limits[key] ?? 0}
                          onChange={e => setLimits(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}/>
                        <span className={styles.settingUnit}>件</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12 }}>
            <button className={styles.saveBtn} onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? '保存中…' : '設定を保存'}
            </button>
            {settingsSaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>
      </div>}

      {/* ─── ユーザー管理 ─── */}
      {activeTab === 'users' && <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>👥 ユーザー管理</h2>
          <p className={styles.sectionDesc}>
            登録ユーザーの一覧と利用状況を確認できます。AI分析のポイント制導入に向けた管理用画面です。<br/>
            アカウント制限は「書き込み制限」（評価・訪問記録の登録不可）と「ログイン不可」の2種類。管理者ユーザーはこれらの制限を一切受けません。
          </p>
        </div>

        {loadingUsers ? (
          <p className={styles.sectionDesc}>読み込み中…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.userTable}>
              <thead>
                <tr>
                  <th>ユーザ名</th>
                  <th>ユーザID</th>
                  <th>権限</th>
                  <th>評価数</th>
                  <th>公開数</th>
                  <th>訪問店舗数</th>
                  <th>ポイント</th>
                  <th>最終ログイン</th>
                  <th>アカウント制限</th>                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name || '（未設定）'}</td>
                    <td><span className={styles.userId} title={u.id}>{u.id}</span></td>
                    <td>
                      {u.is_creator ? (
                        <span className={`${styles.roleBadge} ${styles.roleCreator}`}>製作者</span>
                      ) : isCreator ? (
                        // 製作者のみ権限を変更できる
                        <select
                          className={styles.statusSelect}
                          value={currentRole(u)}
                          disabled={updatingUserId === u.id}
                          onChange={e => updateRole(u.id, e.target.value as 'user'|'subscribed'|'admin')}
                        >
                          <option value="user">一般</option>
                          <option value="subscribed">課金ユーザー</option>
                          <option value="admin">管理者</option>
                        </select>
                      ) : (
                        <span className={`${styles.roleBadge} ${u.is_admin ? styles.roleAdmin : ''}`}>
                          {u.is_admin ? '管理者' : u.is_subscribed ? '課金' : '一般'}
                        </span>
                      )}
                    </td>
                    <td>{u.reviewCount}</td>
                    <td>{u.publicCount}</td>
                    <td>{u.visitCount}</td>
                    <td>
                      {(u.is_admin || u.is_creator) ? (
                        <span className={styles.statusExempt}>消費なし</span>
                      ) : (
                        <span className={styles.pointsCell}>💎 {u.points ?? 0}pt</span>
                      )}
                    </td>
                    <td className={styles.lastSignIn}>
                      {u.lastSignInAt
                        ? new Date(u.lastSignInAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : <span className={styles.statusExempt}>―</span>}
                    </td>
                    <td>
                      {(u.is_admin || u.is_creator) ? (
                        <span className={styles.statusExempt}>制限対象外</span>
                      ) : (
                        <select
                          className={styles.statusSelect}
                          value={u.account_status}
                          disabled={updatingUserId === u.id}
                          onChange={e => updateAccountStatus(u.id, e.target.value)}
                        >
                          {Object.entries(STATUS_LABEL).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* ─── ポイント設定（製作者のみ） ─── */}
      {activeTab === 'points' && isCreator && <div className={styles.section}>
        <h2 className={styles.cardTitle}>💎 AI機能のポイント消費数</h2>
        <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
          各AI機能を使うときに消費するポイント数です。<strong>0 にすると無料</strong>になります。
          （管理者・製作者は元々消費しません）
        </p>
        <div className={styles.settingsCard}>
          {costs.map((c, i) => (
            <div key={c.feature} className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <p className={styles.settingLabel}>{c.label}</p>
                <p className={styles.settingDesc}>機能キー: {c.feature}</p>
              </div>
              <div className={styles.settingControl}>
                <input className={styles.settingInput} type="number" min={0} max={999}
                  value={c.cost}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 0
                    setCosts(prev => prev.map((x, j) => j === i ? { ...x, cost: v } : x))
                  }}/>
                <span className={styles.settingUnit}>pt</span>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12 }}>
            <button className={styles.saveBtn} onClick={saveCosts} disabled={savingCosts}>
              {savingCosts ? '保存中…' : '設定を保存'}
            </button>
            {costsSaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>

        <h2 className={styles.cardTitle} style={{ marginTop: 24 }}>💠 ポイント制度の設定</h2>
        <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
          初期ポイントとログインボーナスの条件を設定します。
        </p>
        <div className={styles.settingsCard}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>初期ポイント</p>
              <p className={styles.settingDesc}>新規登録したユーザーに最初に付与されるポイント</p>
            </div>
            <div className={styles.settingControl}>
              <input className={styles.settingInput} type="number" min={0} max={9999}
                value={pointPolicy.initial}
                onChange={e => setPointPolicy(p => ({ ...p, initial: e.target.value }))}/>
              <span className={styles.settingUnit}>pt</span>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>ログインボーナス：必要日数</p>
              <p className={styles.settingDesc}>累計何日ログインするとボーナスを付与するか</p>
            </div>
            <div className={styles.settingControl}>
              <input className={styles.settingInput} type="number" min={1} max={999}
                value={pointPolicy.loginDays}
                onChange={e => setPointPolicy(p => ({ ...p, loginDays: e.target.value }))}/>
              <span className={styles.settingUnit}>日</span>
            </div>
          </div>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>ログインボーナス：付与ポイント</p>
              <p className={styles.settingDesc}>必要日数を達成したときに付与されるポイント</p>
            </div>
            <div className={styles.settingControl}>
              <input className={styles.settingInput} type="number" min={0} max={9999}
                value={pointPolicy.loginPoints}
                onChange={e => setPointPolicy(p => ({ ...p, loginPoints: e.target.value }))}/>
              <span className={styles.settingUnit}>pt</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12 }}>
            <button className={styles.saveBtn} onClick={savePointPolicy} disabled={savingPolicy}>
              {savingPolicy ? '保存中…' : '設定を保存'}
            </button>
            {policySaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>

        <h2 className={styles.cardTitle} style={{ marginTop: 24 }}>🛒 ポイント購入プラン</h2>
        <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
          購入ページに表示するプランを設定します。「期間限定」にチェックを入れると終了日時を設定でき、
          お一人様1回限りの特別プランとして表示されます。終了日時を未来の日付に更新すると、再び購入ページに表示されます。
        </p>
        <div className={styles.settingsCard}>
          {packages.map((p, i) => (
            <div key={p.id} className={styles.settingRow} style={{ flexWrap: 'wrap', rowGap: 8 }}>
              <div className={styles.settingInfo} style={{ flex: '1 1 100%', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input className={styles.settingInput} style={{ width: 120 }} type="text"
                  value={p.label} placeholder="プラン名"
                  onChange={e => setPackages(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}/>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input className={styles.settingInput} style={{ width: 70 }} type="number" min={1}
                    value={p.points}
                    onChange={e => setPackages(prev => prev.map((x, j) => j === i ? { ...x, points: parseInt(e.target.value) || 0 } : x))}/>
                  pt
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  ¥
                  <input className={styles.settingInput} style={{ width: 90 }} type="number" min={0}
                    value={p.price_yen}
                    onChange={e => setPackages(prev => prev.map((x, j) => j === i ? { ...x, price_yen: parseInt(e.target.value) || 0 } : x))}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={!!p.is_limited}
                    onChange={e => setPackages(prev => prev.map((x, j) => j === i ? { ...x, is_limited: e.target.checked } : x))}/>
                  期間限定
                </label>
                {p.is_limited && (
                  <input className={styles.settingInput} style={{ width: 190 }} type="datetime-local"
                    value={p.limited_until ? new Date(p.limited_until).toISOString().slice(0,16) : ''}
                    onChange={e => setPackages(prev => prev.map((x, j) => j === i ? { ...x, limited_until: e.target.value ? new Date(e.target.value).toISOString() : null } : x))}/>
                )}
                <button className={styles.cancelBtn} onClick={() => removePackageRow(p.id, !!p._new)}>削除</button>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button className={styles.cancelBtn} onClick={addPackageRow}>＋ プランを追加</button>
            <button className={styles.saveBtn} onClick={savePackages} disabled={savingPackages}>
              {savingPackages ? '保存中…' : 'プランを保存'}
            </button>
            {packagesSaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>
      </div>}

      {/* ─── ホーム設定 ─── */}
      {activeTab === 'home' && <div className={styles.section}>
        <h2 className={styles.cardTitle}>📣 お知らせ</h2>
        <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
          ホーム画面（ログイン後の最初の画面）に表示されるお知らせを管理します。
        </p>
        <div className={styles.settingsCard}>
          {announcements.map((a, i) => (
            <div key={a.id} className={styles.settingRow} style={{ flexWrap: 'wrap', rowGap: 8, alignItems: 'flex-start' }}>
              <div className={styles.settingInfo} style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: '100%' }} type="text"
                  value={a.title} placeholder="タイトル"
                  onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}/>
                <label style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                  掲載期間（開始日時を未来にすると予約投稿。終了日時は未設定なら無期限）
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12 }}>開始</span>
                  <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 190 }} type="datetime-local"
                    value={a.published_at ? new Date(a.published_at).toISOString().slice(0,16) : ''}
                    onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i
                      ? { ...x, published_at: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() }
                      : x))}/>
                  <span style={{ fontSize: 12 }}>終了</span>
                  <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 190 }} type="datetime-local"
                    value={a.expires_at ? new Date(a.expires_at).toISOString().slice(0,16) : ''}
                    onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i
                      ? { ...x, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }
                      : x))}/>
                  {a.expires_at && (
                    <button type="button" className={styles.cancelBtn}
                      onClick={() => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, expires_at: null } : x))}>
                      終了日をクリア
                    </button>
                  )}
                </div>
                <textarea className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: '100%', minHeight: 60 }}
                  value={a.body ?? ''} placeholder="本文（任意）"
                  onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={a.is_active}
                      onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))}/>
                    公開する
                  </label>
                  <button className={styles.cancelBtn} onClick={() => removeAnnRow(a.id, !!a._new)}>削除</button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button className={styles.cancelBtn} onClick={addAnnRow}>＋ お知らせを追加</button>
            <button className={styles.saveBtn} onClick={saveAnnouncements} disabled={savingAnn}>
              {savingAnn ? '保存中…' : 'お知らせを保存'}
            </button>
            {annSaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>

        <h2 className={styles.cardTitle} style={{ marginTop: 24 }}>🎗 My-Teasパートナー（広告バナー）</h2>
        <p className={styles.settingDesc} style={{ marginBottom: 12 }}>
          スポンサーがついた際、ホーム画面下部に表示するバナーです。「画像を選択」から直接アップロードしてください
          （Googleドライブの画像を使いたい場合は、ファイルを「リンクを知っている全員が閲覧可」に共有し、
          URLを <code>https://drive.google.com/uc?export=view&id=ファイルID</code> の形式に書き換えて
          「バナー画像URL」欄に貼り付けても表示できます。ただしGoogleドライブ側の仕様変更で
          突然表示できなくなることがあるため、直接アップロードを推奨します）。
          画像を設定しない場合は、ラベル文字のみのカードになります。
        </p>
        <div className={styles.settingsCard}>
          {homeLinks.filter(l => l.kind === 'ad').map((l) => (
            <div key={l.id} className={styles.settingRow} style={{ flexWrap: 'wrap', rowGap: 8 }}>
              <div className={styles.settingInfo} style={{ flex: '1 1 100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 160 }} type="text" value={l.label} placeholder="パートナー名"
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, label: e.target.value } : x))}/>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 260 }} type="text" value={l.url} placeholder="リンク先URL"
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, url: e.target.value } : x))}/>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 260 }} type="text" value={l.image_url ?? ''} placeholder="バナー画像URL（任意・下のアップロードでも自動入力）"
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, image_url: e.target.value } : x))}/>
                <label className={styles.cancelBtn} style={{ cursor: 'pointer' }}>
                  {uploadingAdId === l.id ? 'アップロード中…' : '🖼 画像を選択'}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    disabled={uploadingAdId === l.id}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAdImage(l.id, f); e.target.value = '' }}/>
                </label>
                {l.image_url && <img src={l.image_url} alt="" style={{ height: 32, borderRadius: 4 }}/>}

                <label style={{ fontSize: 11, color: 'var(--text-hint)', width: '100%' }}>掲載期間（未設定はそれぞれ無期限）</label>
                <span style={{ fontSize: 12 }}>開始</span>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 190 }} type="datetime-local"
                  value={l.start_at ? new Date(l.start_at).toISOString().slice(0,16) : ''}
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, start_at: e.target.value ? new Date(e.target.value).toISOString() : null } : x))}/>
                <span style={{ fontSize: 12 }}>終了</span>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 190 }} type="datetime-local"
                  value={l.end_at ? new Date(l.end_at).toISOString().slice(0,16) : ''}
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, end_at: e.target.value ? new Date(e.target.value).toISOString() : null } : x))}/>

                <label style={{ fontSize: 11, color: 'var(--text-hint)', width: '100%' }}>
                  SNSリンク（このパートナーのバナー下に表示。未入力のボタンはグレーアウトします）
                </label>
                <span style={{ fontSize: 12, width: 24 }}>𝕏</span>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 250 }} type="text"
                  value={l.sns_x_url ?? ''} placeholder="https://x.com/..."
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, sns_x_url: e.target.value } : x))}/>
                <span style={{ fontSize: 12, width: 24 }}>📷</span>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 250 }} type="text"
                  value={l.sns_instagram_url ?? ''} placeholder="https://instagram.com/..."
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, sns_instagram_url: e.target.value } : x))}/>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 90 }} type="text"
                  value={l.sns_other_label ?? ''} placeholder="その他"
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, sns_other_label: e.target.value } : x))}/>
                <input className={`${styles.settingInput} ${styles.settingInputText}`} style={{ width: 250 }} type="text"
                  value={l.sns_other_url ?? ''} placeholder="https://..."
                  onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, sns_other_url: e.target.value } : x))}/>

                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={l.is_active}
                    onChange={e => setHomeLinks(prev => prev.map(x => x.id === l.id ? { ...x, is_active: e.target.checked } : x))}/>
                  公開する
                </label>
                <button className={styles.cancelBtn} onClick={() => removeLinkRow(l.id, !!l._new)}>削除</button>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button className={styles.cancelBtn} onClick={addAdRow}>＋ パートナー枠を追加</button>
            <button className={styles.saveBtn} onClick={saveHomeLinks} disabled={savingLinks}>
              {savingLinks ? '保存中…' : 'パートナー情報を保存'}
            </button>
            {linksSaved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ 保存しました</span>}
          </div>
        </div>
      </div>}
    </div>
  )
}
