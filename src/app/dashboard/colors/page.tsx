'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import TeaCupPreview from '@/components/TeaCup'
import styles from './colors.module.css'

// 上限は写真取り込みモーダルからの登録でも使うため、共通定義を参照する
import { MAX_USER_COLORS } from '@/lib/colorPalette'

const CAT_LABELS: Record<string, string> = {
  red: '赤系', orange: '橙系', yellow: '黄系',
  green: '緑系', brown: '茶褐色系', clear: '透明系', other: 'その他',
}
const CAT_ORDER = ['red','orange','yellow','green','brown','clear','other']

function hexToRgba(hex: string, a = 0.85): string {
  const h = (hex ?? '').replace('#', '')
  if (h.length >= 6) {
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
  }
  return `rgba(200,169,110,${a})`
}

// ─── 大きなティーカップ プレビュー ────────────────────
// ─── 紅茶系色相環コンポーネント ─────────────────────────
function TeaColorWheel({ colors, onSelect }: { colors: any[]; onSelect: (c: any) => void }) {
  const [hovered, setHovered] = useState<any>(null)
  if (!colors.length) return <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'3rem' }}>表示できる色がありません</p>

  const cx = 260, cy = 260, outerR = 220, innerR = 100
  const count = colors.length
  const arcAngle = (2 * Math.PI) / count
  const gap = 0.025 // ラジアン単位の隙間

  function polarToXY(angle: number, r: number) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  function buildArcPath(i: number, outer: number, inner: number) {
    const startA = i * arcAngle - Math.PI / 2 + gap
    const endA = (i + 1) * arcAngle - Math.PI / 2 - gap
    const o1 = polarToXY(startA, outer)
    const o2 = polarToXY(endA, outer)
    const i1 = polarToXY(endA, inner)
    const i2 = polarToXY(startA, inner)
    const large = arcAngle - gap * 2 > Math.PI ? 1 : 0
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outer} ${outer} 0 ${large} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${inner} ${inner} 0 ${large} 0 ${i2.x} ${i2.y}`,
      'Z'
    ].join(' ')
  }

  function getLabelPos(i: number) {
    const midA = (i + 0.5) * arcAngle - Math.PI / 2
    const r = (outerR + innerR) / 2
    return polarToXY(midA, r)
  }

  function hexToRgba(hex: string, a = 0.9): string {
    const h = (hex ?? '').replace('#', '')
    if (h.length >= 6) {
      return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
    }
    return `rgba(200,169,110,${a})`
  }

  // カップの背景色を判定（ラベルの色を白か黒かで決める）
  function isDark(hex: string): boolean {
    const h = hex.replace('#','')
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16)
    return (r * 0.299 + g * 0.587 + b * 0.114) < 140
  }

  const hov = hovered

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1.5rem', padding:'1rem 0' }}>
      <svg viewBox="0 0 520 520" width="100%" style={{ maxWidth:520 }} aria-label="紅茶系の色相環">
        {/* 中央カップ（共通TeaCupコンポーネントを使用） */}
        <foreignObject x={cx - (innerR - 6)} y={cy - (innerR - 6)} width={(innerR - 6) * 2} height={(innerR - 6) * 2}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TeaCupPreview hex={hov ? hov.hex : '#C8A96E'} size={(innerR - 6) * 2} />
          </div>
        </foreignObject>

        {/* 未ホバー時のみ案内を表示（ホバー時はカップの色がよく見えるよう文字を出さない） */}
        {!hov && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fill="#6b6760" fontWeight="500">
              お茶の色
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#9e9b96">
              ホバーで確認
            </text>
          </>
        )}

        {/* 扇形アーク */}
        {colors.map((c, i) => {
          const fill = hexToRgba(c.hex, 0.82)
          const isHov = hov?.id === c.id
          const lp = getLabelPos(i)
          const dark = isDark(c.hex.slice(0,7))
          const textColor = dark ? 'rgba(255,255,255,0.9)' : 'rgba(30,20,10,0.75)'
          const arcOuter = isHov ? outerR + 10 : outerR
          return (
            <g key={c.id} style={{ cursor:'pointer' }}
              onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(c)}>
              <path d={buildArcPath(i, arcOuter, innerR)}
                fill={fill} stroke="white" strokeWidth="1.5"
                style={{ transition:'d 0.15s' }}/>
              {/* ラベル（扇形の中央） */}
              {count <= 20 && (
                <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontSize={count > 12 ? 9 : 11}
                  fill={textColor} fontWeight="500" style={{ pointerEvents:'none', userSelect:'none' }}>
                  {c.name.length > 6 ? c.name.slice(0,5) + '…' : c.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* 凡例グリッド */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8, width:'100%', maxWidth:520 }}>
        {colors.map(c => (
          <div key={c.id}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, border:'0.5px solid var(--border)', background: hov?.id===c.id ? 'var(--green-light)' : 'var(--bg-card)', cursor:'pointer' }}
            onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(c)}>
            <span style={{ width:18, height:18, borderRadius:'50%', background:hexToRgba(c.hex,0.85), border:'0.5px solid rgba(0,0,0,0.15)', flexShrink:0 }}/>
            <span style={{ fontSize:12, fontWeight:500, color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{c.name}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize:11, color:'var(--text-hint)', textAlign:'center' }}>色をクリックすると編集できます</p>
    </div>
  )
}

// 水色カップの描画は共通コンポーネント @/components/TeaCup を使用

// ─── 色カード ─────────────────────────────────────────
function ColorCard({ color, isAdmin, onEdit, onDelete }: {
  color: any; isAdmin: boolean; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={styles.colorCard}>
      <div className={styles.colorCardCup}>
        <TeaCupPreview hex={color.hex} size={80} />
      </div>
      <div className={styles.colorCardInfo}>
        <div className={styles.colorCardHeader}>
          <span className={styles.colorName}>{color.name}</span>
          {color.name_en && <span className={styles.colorNameEn}>{color.name_en}</span>}
        </div>
        <div className={styles.colorHex}>
          <span className={styles.colorSwatch} style={{ background: hexToRgba(color.hex, 0.8) }}/>
          <code className={styles.colorCode}>{color.hex.slice(0,7)}</code>
          {color.is_official
            ? <span className={styles.officialTag}>🛡 公式</span>
            : <span className={styles.userTag}>👤 ユーザー</span>
          }
        </div>
        {color.description && <p className={styles.colorDesc}>{color.description}</p>}
      </div>
      <div className={styles.colorCardActions}>
        {(isAdmin || !color.is_official) && (
          <>
            <button className={styles.editBtn} onClick={onEdit}>編集</button>
            {(isAdmin || !color.is_official) && (
              <button className={styles.deleteBtn} onClick={onDelete}>削除</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 色追加・編集フォーム ─────────────────────────────
const EMPTY_FORM = {
  name: '', name_en: '', hex: '#C8A96E', alpha: 176,
  description: '', category: 'orange', is_official: false,
}

function ColorForm({ initial, isAdmin, readOnly, onSave, onCancel }: {
  initial?: typeof EMPTY_FORM
  isAdmin: boolean
  readOnly?: boolean
  onSave: (data: typeof EMPTY_FORM) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const fullHex = form.hex + form.alpha.toString(16).padStart(2,'0').toUpperCase()
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className={styles.formWrap}>
      <div className={styles.formPreview}>
        <TeaCupPreview hex={fullHex} size={100} />
        <p className={styles.formPreviewLabel}>{form.name || '色名未入力'}</p>
      </div>
      <div className={styles.formFields}>
        <label className={styles.label}>色名 *</label>
        <input className={styles.input} value={form.name} onChange={set('name')} placeholder="例: 琥珀色" disabled={readOnly}/>
        <label className={styles.label}>英語名（任意）</label>
        <input className={styles.input} value={form.name_en} onChange={set('name_en')} placeholder="例: Amber" disabled={readOnly}/>
        <label className={styles.label}>カテゴリ</label>
        <select className={styles.input} value={form.category} onChange={set('category')} disabled={readOnly}>
          {CAT_ORDER.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
        <label className={styles.label}>色を選択</label>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="color" value={form.hex}
            onChange={e => setForm(f => ({ ...f, hex: e.target.value }))}
            disabled={readOnly}
            style={{ width:48, height:36, border:'none', cursor: readOnly ? 'default' : 'pointer', borderRadius:8 }}/>
          <code style={{ fontSize:12, color:'var(--text-muted)' }}>{form.hex}</code>
        </div>
        <label className={styles.label}>透明度 {Math.round(form.alpha/255*100)}%</label>
        <input type="range" min={80} max={230} value={form.alpha}
          onChange={e => setForm(f => ({ ...f, alpha: +e.target.value }))}
          disabled={readOnly}
          style={{ width:'100%', accentColor:'var(--green)' }}/>
        <label className={styles.label}>説明</label>
        <textarea className={styles.input} rows={2} value={form.description} onChange={set('description')}
          placeholder="どんな茶葉のお茶に多い色か、特徴など…" disabled={readOnly}/>
        {isAdmin && !readOnly && (
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.is_official}
              onChange={e => setForm(f => ({ ...f, is_official: e.target.checked }))}/>
            公式カラーとして登録（全ユーザーのパレットに表示）
          </label>
        )}
        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>{readOnly ? '閉じる' : 'キャンセル'}</button>
          {!readOnly && (
            <button className={styles.saveBtn} onClick={() => onSave({ ...form })} disabled={!form.name}>保存</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── メインページ ─────────────────────────────────────
export default function ColorsPage() {
  const supabase = createClient()
  const [colors, setColors] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterOwner, setFilterOwner] = useState<'all'|'official'|'mine'>('official')
  const [viewMode, setViewMode] = useState<'list'|'wheel'>('list')

  // 編集可能かどうか（管理者/製作者は全て編集可。一般・課金は自分の非公式カラーのみ編集可）
  const canEditColor = (c: any) => isAdmin || (!c.is_official && c.created_by === userId)

  const load = useCallback(async () => {
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) return
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('is_admin,is_creator').eq('id', user.id).single()
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    const { data } = await supabase.from('tea_colors').select('*').order('is_official', { ascending: false }).order('sort_order').order('created_at')
    setColors(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function saveColor(form: typeof EMPTY_FORM) {
    const fullHex = form.hex + form.alpha.toString(16).padStart(2,'0').toUpperCase()
    const isOfficialColor = isAdmin ? form.is_official : false

    // 新規追加かつ個人色の場合は上限チェック
    if (!editTarget && !isOfficialColor) {
      const myColors = colors.filter(c => c.created_by === userId && !c.is_official)
      if (myColors.length >= MAX_USER_COLORS) {
        alert(`個人で登録できる色は最大${MAX_USER_COLORS}色までです。
不要な色を削除してから追加してください。`)
        return
      }
    }

    const payload = {
      name: form.name, name_en: form.name_en || null,
      hex: fullHex, description: form.description || null,
      category: form.category, is_official: isOfficialColor,
    }
    if (editTarget) {
      await supabase.from('tea_colors').update(payload).eq('id', editTarget.id)
    } else {
      await supabase.from('tea_colors').insert({ ...payload, created_by: userId })
    }
    setShowForm(false); setEditTarget(null); load()
  }

  async function deleteColor(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('tea_colors').delete().eq('id', id)
    setColors(cs => cs.filter(c => c.id !== id))
  }

  const filtered = colors.filter(c => {
    if (filterCat && c.category !== filterCat) return false
    if (filterOwner === 'official' && !c.is_official) return false
    if (filterOwner === 'mine' && c.created_by !== userId) return false
    // 「すべて」タブ = 公式の色 ＋ 自分が登録した色（他ユーザーの色は表示しない）
    if (filterOwner === 'all' && !(c.is_official || c.created_by === userId)) return false
    return true
  })

  const grouped = CAT_ORDER.map(cat => ({
    cat, label: CAT_LABELS[cat],
    items: filtered.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>🎨 カラーパレット管理</h1>
          <p className={styles.subtitle}>お茶の水色を名前付きで管理します。茶葉の色設定と連動します。</p>
        </div>
        {(filterOwner === 'mine' || (filterOwner === 'official' && isAdmin) || (filterOwner === 'all')) && (
          <button className={styles.addBtn} onClick={() => { setEditTarget(null); setShowForm(true) }}
            disabled={filterOwner === 'mine' && colors.filter(c => c.created_by === userId && !c.is_official).length >= MAX_USER_COLORS}>
            + 色を追加
            {filterOwner === 'mine' && (() => {
              const n = colors.filter(c => c.created_by === userId && !c.is_official).length
              return n >= MAX_USER_COLORS ? <span style={{fontSize:11, marginLeft:4}}>(上限)</span> : null
            })()}
          </button>
        )}
      </div>

      {/* タブ切り替え + フィルター */}
      <div className={styles.ownerTabs}>
        <button className={`${styles.ownerTab} ${filterOwner==='official' ? styles.ownerTabActive : ''}`}
          onClick={() => setFilterOwner('official')}>
          🛡 公式の色
        </button>
        <button className={`${styles.ownerTab} ${filterOwner==='mine' ? styles.ownerTabActive : ''}`}
          onClick={() => setFilterOwner('mine')}>
          👤 自分の色
          {(() => { const n = colors.filter(c => c.created_by === userId && !c.is_official).length; return n > 0 ? <span className={styles.myColorCount}>{n} / {MAX_USER_COLORS}</span> : null })()}
        </button>
        <button className={`${styles.ownerTab} ${filterOwner==='all' ? styles.ownerTabActive : ''}`}
          onClick={() => setFilterOwner('all')}>
          すべて
        </button>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewToggleBtn} ${viewMode==='list' ? styles.viewToggleBtnActive : ''}`} onClick={() => setViewMode('list')}>📋 リスト</button>
          <button className={`${styles.viewToggleBtn} ${viewMode==='wheel' ? styles.viewToggleBtnActive : ''}`} onClick={() => setViewMode('wheel')}>🎡 色相環</button>
        </div>
        <select className={styles.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">すべての系統</option>
          {CAT_ORDER.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
        <span className={styles.count}>{filtered.length}色</span>
      </div>

      {/* フォーム（インライン表示） */}
      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>
            {editTarget ? (canEditColor(editTarget) ? '色を編集' : '色の詳細') : '新しい色を追加'}
          </h2>
          <ColorForm
            initial={editTarget ? {
              name: editTarget.name, name_en: editTarget.name_en ?? '',
              hex: editTarget.hex.slice(0,7),
              alpha: editTarget.hex.length === 9 ? parseInt(editTarget.hex.slice(7),16) : 176,
              description: editTarget.description ?? '',
              category: editTarget.category ?? 'other',
              is_official: editTarget.is_official,
            } : undefined}
            isAdmin={isAdmin}
            readOnly={!!editTarget && !canEditColor(editTarget)}
            onSave={saveColor}
            onCancel={() => { setShowForm(false); setEditTarget(null) }}
          />
        </div>
      )}

      {/* カラー一覧（カテゴリ別） */}
      {loading ? (
        <p className={styles.hint}>読み込み中…</p>
      ) : viewMode === 'wheel' ? (
        <TeaColorWheel colors={filtered} onSelect={(c) => { setEditTarget(c); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      ) : grouped.length === 0 ? (
        <div className={styles.empty}>
          <p>色が登録されていません</p>
          <button className={styles.addBtn} onClick={() => setShowForm(true)}>+ 最初の色を追加</button>
        </div>
      ) : (
        grouped.map(g => (
          <div key={g.cat} className={styles.catGroup}>
            <h2 className={styles.catTitle}>
              {g.label}
              <span className={styles.catCount}>{g.items.length}色</span>
            </h2>
            <div className={styles.colorGrid}>
              {g.items.map(color => (
                <ColorCard key={color.id} color={color} isAdmin={isAdmin}
                  onEdit={() => { setEditTarget(color); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  onDelete={() => deleteColor(color.id, color.name)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
