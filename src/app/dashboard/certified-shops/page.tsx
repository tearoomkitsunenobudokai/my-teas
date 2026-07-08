'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import styles from './certified-shops.module.css'

const AREAS = ['北海道・東北エリア','関東・甲信越エリア','首都圏エリア','東海・北陸エリア','近畿エリア','中国・四国エリア','九州・沖縄エリア']
const CAT_LABEL: Record<string,string> = { prestige:'プレステージ', authentic:'オーセンティック', casual:'カジュアル' }
const CAT_COLOR: Record<string,string>  = { prestige:'#FAD7A0', authentic:'#A9DFBF', casual:'#AED6F1' }
const MAX_BOOKMARKS = 10

// 通常のGoogle Maps embed URL（住所・店名でジャンプ可能）
// q= に「店名 + 住所」を渡すことで、その地点にピンを立てて表示する
function buildSearchEmbedUrl(shop: any): string {
  const query = [shop.name, shop.address || shop.prefecture || ''].filter(Boolean).join(' ')
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=ja&output=embed`
}

// マイマップ全体表示用URL（店舗未選択時）
function buildMyMapUrl(mid: string): string {
  return `https://www.google.com/maps/d/embed?mid=${mid}&hl=ja`
}

// ─── Google Maps 埋め込みコンポーネント ────────────────
// 店舗未選択時: マイマップ全体（全ピン一覧）を表示
// 店舗選択時  : 通常のMapsでその店舗の住所にジャンプして表示（クリック連動が効く）
function MyMapEmbed({ mapId, selectedShop, forceMyMap }: { mapId: string; selectedShop: any|null; forceMyMap?: boolean }) {
  // 店舗が選択されていれば、マップID設定の有無に関わらずジャンプ表示を優先
  if (selectedShop) {
    const hasLocation = selectedShop.address || selectedShop.prefecture
    if (!hasLocation) {
      return (
        <div className={styles.mapPlaceholder}>
          <div className={styles.mapPlaceholderInner}>
            <p className={styles.mapPlaceholderTitle}>📍 住所情報がありません</p>
            <p className={styles.mapPlaceholderSub}>この店舗には住所・都道府県が登録されていないため、地図上で表示できません。店舗情報を編集して住所を追加してください。</p>
          </div>
        </div>
      )
    }
    return (
      <div className={styles.mapWrap}>
        <iframe
          key={selectedShop.id} // 店舗が変わるたびに再マウントしてジャンプさせる
          src={buildSearchEmbedUrl(selectedShop)}
          className={styles.mapIframe}
          allowFullScreen
          loading="lazy"
          title={`${selectedShop.name}の地図`}
        />
        <div className={styles.mapOverlayBadge}>
          <span>📍 {selectedShop.name}</span>
          <span className={styles.mapOverlayHint}>住所から自動的にこの場所を表示しています</span>
        </div>
      </div>
    )
  }

  // 店舗未選択時：マイマップ全体（設定されていれば）
  if (!mapId) {
    return (
      <div className={styles.mapPlaceholder}>
        <div className={styles.mapPlaceholderInner}>
          <p className={styles.mapPlaceholderTitle}>
            {forceMyMap ? '🗺️ マイマップがまだ設定されていません' : '🗺️ 店舗をクリックすると地図が表示されます'}
          </p>
          <p className={styles.mapPlaceholderSub}>
            {forceMyMap ? '管理者がマップIDを設定すると、ここに全店舗のマイマップが表示されます。' : '左のリストから店舗を選ぶと、その住所に地図がジャンプします。'}
          </p>
          <hr className={styles.placeholderDivider}/>
          <p className={styles.mapPlaceholderSubTitle}>全店舗をまとめて見たい場合</p>
          <ol className={styles.mapPlaceholderSteps}>
            <li><a href="https://www.google.com/mymaps" target="_blank" rel="noopener" className={styles.mapLink}>Google マイマップ</a> でマップを作成</li>
            <li>「共有」→「一般公開」に設定</li>
            <li>URLの <code>mid=XXXX</code> をコピーして「🗺️ マップ設定」に貼り付け</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.mapWrap}>
      <iframe
        key={mapId}
        src={buildMyMapUrl(mapId)}
        className={styles.mapIframe}
        allowFullScreen
        loading="lazy"
        title="認定店マイマップ（全体表示）"
      />
      <div className={styles.mapOverlayBadge}>
        <span>🗺️ 全店舗表示中</span>
        <span className={styles.mapOverlayHint}>左のリストで店舗をクリックすると、その場所にジャンプします</span>
      </div>
    </div>
  )
}

// ─── ブックマークパネル ───────────────────────────────
function BookmarkPanel({ bookmarks, shops, onRemove, onSelect }: {
  bookmarks: any[]; shops: any[]
  onRemove: (id:string) => void; onSelect: (shop:any) => void
}) {
  return (
    <div className={styles.bookmarkPanel}>
      <div className={styles.bookmarkHeader}>
        <span className={styles.bookmarkTitle}>⭐ ブックマーク</span>
        <span className={styles.bookmarkCount}>{bookmarks.length} / {MAX_BOOKMARKS}</span>
      </div>
      {bookmarks.length === 0 ? (
        <p className={styles.bookmarkEmpty}>店舗の ☆ をクリックして登録（最大{MAX_BOOKMARKS}件）</p>
      ) : (
        <div className={styles.bookmarkList}>
          {bookmarks.map(bm => {
            const shop = shops.find(s => s.id === bm.shop_id)
            if (!shop) return null
            return (
              <div key={bm.id} className={styles.bookmarkItem} onClick={() => onSelect(shop)}>
                <div className={styles.bookmarkItemInfo}>
                  <span className={styles.bookmarkItemName}>{shop.name}</span>
                  <span className={styles.bookmarkItemAddr}>{shop.prefecture}</span>
                </div>
                <button className={styles.bookmarkRemoveBtn}
                  onClick={e => { e.stopPropagation(); onRemove(bm.id) }} title="解除">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── KML エクスポート ─────────────────────────────────
// マイマップの「インポート」機能（ファイル > インポート）に直接読み込める形式
function buildKml(shops: any[]): string {
  const esc = (s: string) => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const placemarks = shops
    .filter(s => s.address || s.prefecture) // 位置情報の元になるテキストがある店舗のみ
    .map(s => {
      const addr = s.address || s.prefecture || ''
      const descParts = [
        s.category ? `カテゴリ: ${CAT_LABEL[s.category] ?? s.category}` : '',
        s.year ? `認定年度: ${s.year}年度` : '',
        s.url ? `URL: ${s.url}` : '',
        s.note ? `メモ: ${s.note}` : '',
      ].filter(Boolean).join('\\n')
      return `    <Placemark>
      <name>${esc(s.name)}</name>
      <description>${esc(descParts)}</description>
      <address>${esc(addr)}</address>
    </Placemark>`
    }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>TeaNote 認定店リスト</name>
${placemarks}
  </Document>
</kml>`
}

function downloadKml(shops: any[], year: number) {
  const kml = buildKml(shops)
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `teanote_certified_shops_${year}.kml`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── コピー用テキスト出力モーダル ──────────────────────
// マイマップの「インポート」→「貼り付けてインポート」機能向け（CSV風タブ区切り）
function ExportTextModal({ shops, onClose }: { shops: any[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const validShops = shops.filter(s => s.address || s.prefecture)
  const text = ['店名\t住所\tメモ']
    .concat(validShops.map(s => {
      const addr = s.address || s.prefecture || ''
      const memo = [CAT_LABEL[s.category] ?? '', s.year ? `${s.year}年度` : ''].filter(Boolean).join(' / ')
      return `${s.name}\t${addr}\t${memo}`
    }))
    .join('\n')

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('コピーに失敗しました。テキストを選択して手動でコピーしてください。')
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 560 }}>
        <h3 className={styles.modalTitle}>📋 マイマップ用テキストを出力</h3>
        <p className={styles.mapIdNote}>
          以下のテキストをコピーして、Google マイマップの<br/>
          「インポート」→「貼り付けてインポート」に貼り付けてください。<br/>
          住所が登録されている店舗のみ出力されます（{validShops.length} / {shops.length}件）。
        </p>
        <textarea
          className={styles.exportTextarea}
          value={text}
          readOnly
          rows={12}
          onClick={e => (e.target as HTMLTextAreaElement).select()}
        />
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>閉じる</button>
          <button className={styles.saveBtn} onClick={copyText}>
            {copied ? '✓ コピーしました' : '📋 テキストをコピー'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── マップID設定モーダル ─────────────────────────────
function MapIdModal({ current, onSave, onClose }: {
  current: string; onSave: (id:string) => void; onClose: () => void
}) {
  const [val, setVal] = useState(current)
  // URLから mid= を抽出
  function extract(input: string): string {
    const m = input.match(/mid=([^&\s]+)/)
    return m ? m[1] : input.trim()
  }
  return (
    <div className={styles.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 480 }}>
        <h3 className={styles.modalTitle}>🗺️ Google マイマップ ID を設定</h3>
        <p className={styles.mapIdNote}>
          Google マイマップのURLまたはマップIDを貼り付けてください。<br/>
          例: <code>https://www.google.com/maps/d/viewer?mid=<strong>1czD14f...</strong></code>
        </p>
        <label className={styles.label}>マップURL または マップID</label>
        <input className={styles.input} value={val} onChange={e => setVal(e.target.value)}
          placeholder="https://www.google.com/maps/d/viewer?mid=XXXX または XXXX"/>
        <p className={styles.mapIdSteps}>
          <strong>マイマップの設定手順:</strong><br/>
          1. <a href="https://www.google.com/mymaps" target="_blank" rel="noopener" className={styles.coordLink}>Google マイマップ</a> でマップを開く<br/>
          2. 「共有」ボタン → 「一般公開」に変更<br/>
          3. URLをコピーしてここに貼り付け<br/>
          4. 認定店のピンはマイマップ上で直接追加・編集できます
        </p>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
          <button className={styles.saveBtn} onClick={() => { onSave(extract(val)); onClose() }}>保存</button>
        </div>
      </div>
    </div>
  )
}

// ─── メインページ ─────────────────────────────────────
export default function CertifiedShopsPage() {
  const supabase = createClient()
  const [shops, setShops] = useState<any[]>([])
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [filterArea, setFilterArea] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showVisitedOnly, setShowVisitedOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showMapIdModal, setShowMapIdModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkYear, setBulkYear] = useState<number>(new Date().getFullYear())
  const [bulkText, setBulkText] = useState('')
  // Google マイマップ ID（DBまたはlocalStorageで永続化）
  const [mapId, setMapId] = useState('')
  const [showMyMap, setShowMyMap] = useState(false)  // 「全体マイマップを表示」ボタンで明示的に切り替え
  const [form, setForm] = useState({
    name:'', address:'', prefecture:'', area:'', category:'authentic',
    is_new:false, is_award:false, year:new Date().getFullYear(), url:'', note:''
  })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [{ data: profile }, { data: yearsData }, { data: bms }, { data: vts }] = await Promise.all([
      supabase.from('profiles').select('is_admin,is_creator').eq('id', user.id).single(),
      supabase.from('certified_shop_years')
        .select('id, year, category, is_new, is_award, certified_shop_masters(id, name, address, prefecture, area, url, note, lat, lng)'),
      supabase.from('shop_bookmarks').select('*').eq('user_id', user.id),
      supabase.from('shop_visits').select('*').eq('user_id', user.id),
    ])
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    if (yearsData) {
      // マスター＋年度別レコードをフラットな形に変換
      // id = 店舗マスターのid（ブックマーク・訪問記録・地図表示はこちらで紐付け＝年度をまたいで引き継がれる）
      // yearRowId = その年度の認定記録のid（削除操作の対象）
      const flattened = (yearsData as any[])
        .filter(row => row.certified_shop_masters)
        .map(row => ({
          yearRowId: row.id,
          id: row.certified_shop_masters.id,
          name: row.certified_shop_masters.name,
          address: row.certified_shop_masters.address,
          prefecture: row.certified_shop_masters.prefecture,
          area: row.certified_shop_masters.area,
          url: row.certified_shop_masters.url,
          note: row.certified_shop_masters.note,
          lat: row.certified_shop_masters.lat,
          lng: row.certified_shop_masters.lng,
          year: row.year,
          category: row.category,
          is_new: row.is_new,
          is_award: row.is_award,
        }))
        .sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '') || a.name.localeCompare(b.name))
      setShops(flattened)
      const ys = [...new Set(flattened.map(s => s.year))].sort((a, b) => b - a)
      setYears(ys.length ? ys : [new Date().getFullYear()])
      if (ys.length) setSelectedYear(ys[0])
    }
    setBookmarks(bms ?? [])
    setVisits(vts ?? [])
  }, [supabase])

  // マップIDをSupabase app_settings または localStorage から読み込み
  useEffect(() => {
    load()
    const saved = localStorage.getItem('teanote_map_id') ?? ''
    setMapId(saved)
  }, [load])

  function saveMapId(id: string) {
    setMapId(id)
    localStorage.setItem('teanote_map_id', id)
  }

  const bookmarkedIds = new Set(bookmarks.map(b => b.shop_id))
  const visitedIds = new Set(visits.map(v => v.shop_id))
  const filtered = shops.filter(s =>
    s.year === selectedYear &&
    (!filterArea || s.area === filterArea) &&
    (!filterCat || s.category === filterCat) &&
    (!showVisitedOnly || visitedIds.has(s.id)) &&
    (!search || s.name.includes(search) || s.prefecture?.includes(search) || s.address?.includes(search))
  )
  const byArea = AREAS.map(area => ({ area, shops: filtered.filter(s => s.area === area) })).filter(g => g.shops.length > 0)

  async function toggleBookmark(e: React.MouseEvent, shop: any) {
    e.stopPropagation()
    const existing = bookmarks.find(b => b.shop_id === shop.id)
    if (existing) {
      await supabase.from('shop_bookmarks').delete().eq('id', existing.id)
      setBookmarks(bs => bs.filter(b => b.id !== existing.id))
    } else {
      if (bookmarks.length >= MAX_BOOKMARKS) { alert(`ブックマークは最大${MAX_BOOKMARKS}件です`); return }
      const { data } = await supabase.from('shop_bookmarks').insert({ user_id: userId, shop_id: shop.id }).select().single()
      if (data) setBookmarks(bs => [...bs, data])
    }
  }

  // 訪問済みのトグル（プロフィールの認定店制覇数に直結）
  async function toggleVisit(e: React.MouseEvent, shop: any) {
    e.stopPropagation()
    const existing = visits.find(v => v.shop_id === shop.id)
    if (existing) {
      if (!confirm(`「${shop.name}」を訪問済みから外しますか？`)) return
      await supabase.from('shop_visits').delete().eq('id', existing.id)
      setVisits(vs => vs.filter(v => v.id !== existing.id))
    } else {
      const { data, error } = await supabase.from('shop_visits').insert({ user_id: userId, shop_id: shop.id }).select().single()
      if (error) { alert(error.message); return }
      if (data) setVisits(vs => [...vs, data])
    }
  }

  async function removeBookmark(id: string) {
    await supabase.from('shop_bookmarks').delete().eq('id', id)
    setBookmarks(bs => bs.filter(b => b.id !== id))
  }

  // 店舗マスターを name+address で検索し、無ければ新規作成してidを返す
  async function findOrCreateMasterId(
    name: string, address: string, prefecture: string, area: string, url: string, note: string
  ): Promise<string | null> {
    let query = supabase.from('certified_shop_masters').select('id').eq('name', name)
    query = address ? query.eq('address', address) : query.is('address', null)
    const { data: existing } = await query.maybeSingle()
    if (existing) return existing.id
    const { data: created, error } = await supabase.from('certified_shop_masters')
      .insert({ name, address: address || null, prefecture: prefecture || null, area: area || null, url: url || null, note: note || null })
      .select('id').single()
    if (error) { alert(error.message); return null }
    return created?.id ?? null
  }

  async function addShop() {
    setSaving(true)
    const shopId = await findOrCreateMasterId(form.name, form.address, form.prefecture, form.area, form.url, form.note)
    if (shopId) {
      const { error } = await supabase.from('certified_shop_years').insert({
        shop_id: shopId, year: form.year, category: form.category, is_new: form.is_new, is_award: form.is_award,
      })
      if (error) alert(error.message)
    }
    setSaving(false); setShowAdd(false)
    setForm({ name:'', address:'', prefecture:'', area:'', category:'authentic', is_new:false, is_award:false, year:new Date().getFullYear(), url:'', note:'' })
    load()
  }

  // yearRowId: その年度の認定記録（certified_shop_years）のid。
  // 店舗マスター自体や他年度の記録は削除されない。
  async function deleteShop(yearRowId: string) {
    if (!confirm('この年度の認定記録を削除しますか？（店舗情報自体や他年度の記録は残ります）')) return
    await supabase.from('certified_shop_years').delete().eq('id', yearRowId)
    setShops(ss => ss.filter(s => s.yearRowId !== yearRowId))
    if (selectedShop?.yearRowId === yearRowId) setSelectedShop(null)
  }

  async function deleteYear(year: number) {
    if (!confirm(`${year}年度を全削除しますか？（店舗マスター情報は残ります）`)) return
    await supabase.from('certified_shop_years').delete().eq('year', year)
    load()
  }

  async function bulkImport() {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    const parsed = lines.map(line => {
      const [name, prefecture, area, category, address, url] = line.split('\t').map(s => s.trim())
      return { name, prefecture, area: area || '', category: category || 'authentic', address: address || '', url: url || '' }
    }).filter(x => x.name)
    if (!parsed.length) return
    setSaving(true)
    for (const p of parsed) {
      const shopId = await findOrCreateMasterId(p.name, p.address, p.prefecture, p.area, p.url, '')
      if (shopId) {
        await supabase.from('certified_shop_years').insert({
          shop_id: shopId, year: bulkYear, category: p.category, is_new: true, is_award: false,
        })
      }
    }
    setSaving(false); setBulkMode(false); setBulkText(''); load()
  }

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className={styles.pageWrap}>
      {/* ─── 左ペイン ─── */}
      <div className={styles.leftPane}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>日本紅茶協会 認定店</h1>
            <p className={styles.subtitle}>
              <a href="https://www.tea-a.gr.jp/shop/" target="_blank" rel="noopener" className={styles.link}>おいしい紅茶の店</a> 認定リスト
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={`${styles.visitCountBadge} ${showVisitedOnly ? styles.btnActive : ''}`}
              onClick={() => { setShowVisitedOnly(v => !v); setShowBookmarks(false) }}
              title="クリックで訪問済みの店だけを表示／全表示を切り替え">
              ✅ {visits.length}店 制覇
            </button>
            <button className={`${styles.btnSecondary} ${showBookmarks ? styles.btnActive : ''}`}
              onClick={() => setShowBookmarks(v => !v)}>
              ⭐ {bookmarks.length > 0 && <span className={styles.bmCount}>{bookmarks.length}</span>}
            </button>
            {isAdmin && <>
              <button className={styles.btnSecondary} onClick={() => setShowMapIdModal(true)}>🗺️ マップ設定</button>
              <button className={styles.btnSecondary} onClick={() => downloadKml(filtered, selectedYear)} title="マイマップにインポートできるKMLファイルをダウンロード">📥 KML出力</button>
              <button className={styles.btnSecondary} onClick={() => setShowExportModal(true)} title="マイマップに貼り付けてインポートできるテキストを表示">📋 テキスト出力</button>
              <button className={styles.btnSecondary} onClick={() => setBulkMode(true)}>一括インポート</button>
              <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>+ 追加</button>
              <button className={styles.btnDanger} onClick={() => deleteYear(selectedYear)}>{selectedYear}年度削除</button>
            </>}
          </div>
        </div>

        {/* ブックマークパネル */}
        {showBookmarks && (
          <BookmarkPanel bookmarks={bookmarks} shops={shops}
            onRemove={removeBookmark}
            onSelect={s => { setSelectedShop(s); setShowBookmarks(false); setShowMyMap(false) }} />
        )}

        {/* 年度タブ */}
        <div className={styles.yearTabs}>
          {years.map(y => (
            <button key={y} className={`${styles.yearTab} ${selectedYear===y ? styles.yearTabActive : ''}`}
              onClick={() => setSelectedYear(y)}>{y}年度</button>
          ))}
        </div>

        {/* フィルター */}
        <div className={styles.filters}>
          <input className={styles.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="店名・住所で検索…"/>
          <select className={styles.select} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="">すべてのエリア</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={styles.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">カテゴリ</option>
            <option value="prestige">プレステージ</option>
            <option value="authentic">オーセンティック</option>
            <option value="casual">カジュアル</option>
          </select>
          <span className={styles.count}>{filtered.length}件</span>
        </div>

        {/* 店舗リスト */}
        <div className={styles.shopList}>
          {byArea.length === 0 ? (
            <div className={styles.empty}>
              <p>{showVisitedOnly ? 'この年度の訪問済みのお店はまだありません' : '店舗が見つかりません'}</p>
              {showVisitedOnly && <button className={styles.btnSecondary} onClick={() => setShowVisitedOnly(false)}>全ての店を表示</button>}
              {!showVisitedOnly && isAdmin && <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>+ 追加</button>}
            </div>
          ) : byArea.map(({ area, shops: aShops }) => (
            <div key={area} className={styles.areaGroup}>
              <h2 className={styles.areaTitle}>{area} <span className={styles.areaCount}>{aShops.length}店</span></h2>
              {aShops.map((s:any) => {
                const isBm = bookmarkedIds.has(s.id)
                const isVisited = visitedIds.has(s.id)
                const isSel = selectedShop?.id === s.id
                return (
                  <div key={s.id}
                    className={`${styles.shopRow} ${isSel ? styles.shopRowSelected : ''} ${isVisited ? styles.shopRowVisited : ''}`}
                    onClick={() => { setSelectedShop(isSel ? null : s); setShowMyMap(false) }}>
                    <div className={styles.shopRowLeft}>
                      <div style={{ minWidth:0 }}>
                        <div className={styles.shopRowName}>
                          {s.name}
                          {isVisited && <span className={styles.visitedBadge}>✅ 訪問済</span>}
                          {s.is_new && <span className={styles.newBadge}>NEW</span>}
                          {s.is_award && <span className={styles.awardBadge}>🏆</span>}
                        </div>
                        <div className={styles.shopRowAddr}>{s.address || s.prefecture || '—'}</div>
                      </div>
                    </div>
                    <div className={styles.shopRowRight}>
                      <span className={styles.catBadge} style={{ background:CAT_COLOR[s.category]??'#eee' }}>
                        {CAT_LABEL[s.category]}
                      </span>
                      <button className={`${styles.visitBtn} ${isVisited ? styles.visitBtnActive : ''}`}
                        onClick={e => toggleVisit(e, s)} title={isVisited ? '訪問済みを解除' : '訪問済みにする'}>
                        {isVisited ? '✅' : '⬜'}
                      </button>
                      <button className={`${styles.bmBtn} ${isBm ? styles.bmBtnActive : ''}`}
                        onClick={e => toggleBookmark(e, s)} title={isBm ? 'ブックマーク解除' : 'ブックマーク追加'}>
                        {isBm ? '★' : '☆'}
                      </button>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener" className={styles.shopLinkBtn}
                          onClick={e => e.stopPropagation()} title="公式サイト">↗</a>
                      )}
                      {isAdmin && <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteShop(s.yearRowId) }}>削除</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* 選択中店舗情報（リスト下部） */}
        {selectedShop && (
          <div className={styles.selectedPanel}>
            <div className={styles.selectedPanelTop}>
              <strong className={styles.selectedPanelName}>{selectedShop.name}</strong>
              <button className={styles.clearBtn} onClick={() => setSelectedShop(null)}>✕</button>
            </div>
            {selectedShop.address && <p className={styles.selectedPanelAddr}>📍 {selectedShop.address}</p>}
            {selectedShop.note && <p className={styles.selectedPanelNote}>{selectedShop.note}</p>}
            {selectedShop.url && (
              <a href={selectedShop.url} target="_blank" rel="noopener" className={styles.selectedPanelLink}>
                公式サイトを開く →
              </a>
            )}
            <p className={styles.selectedPanelHint}>
              📍 右側の地図がこの店舗の住所にジャンプして表示されています
            </p>
          </div>
        )}
      </div>

      {/* ─── 右ペイン（マイマップ） ─── */}
      <div className={styles.rightPane}>
        <div className={styles.mapHeader}>
          <div className={styles.mapHeaderTop}>
            <span className={styles.mapTitle}>
              {showMyMap ? '🗺️ マイマップ（全体表示）' : selectedShop ? `🗺️ ${selectedShop.name}` : '🗺️ Google マップ'}
            </span>
            {mapId && (
              <button
                className={`${styles.mapToggleBtn} ${showMyMap ? styles.mapToggleBtnActive : ''}`}
                onClick={() => {
                  if (!showMyMap) { setSelectedShop(null) } // 全体表示に切り替えるときは個別選択を解除
                  setShowMyMap(v => !v)
                }}>
                {showMyMap ? '✕ 個別表示に戻す' : '🗺️ 全体地図を表示'}
              </button>
            )}
          </div>
          <span className={styles.mapHint}>
            {showMyMap
              ? 'マイマップ上の全ピンを表示中。店舗をクリックすると個別ジャンプに切り替わります'
              : selectedShop
                ? '店舗の住所にジャンプして表示中'
                : mapId
                  ? '店舗をクリックすると地図がジャンプします。右上のボタンで全体表示にも切り替えられます'
                  : '店舗をクリックすると地図が自動でその場所に移動します'}
          </span>
          {isAdmin && !mapId && !selectedShop && (
            <button className={styles.btnPrimary} style={{ marginTop:6, fontSize:12, padding:'5px 10px' }}
              onClick={() => setShowMapIdModal(true)}>
              🗺️ マップIDを設定する
            </button>
          )}
        </div>
        <MyMapEmbed mapId={mapId} selectedShop={showMyMap ? null : selectedShop} forceMyMap={showMyMap} />
      </div>

      {/* マップID設定モーダル */}
      {showMapIdModal && (
        <MapIdModal current={mapId} onSave={saveMapId} onClose={() => setShowMapIdModal(false)} />
      )}

      {/* テキスト出力モーダル */}
      {showExportModal && (
        <ExportTextModal shops={filtered} onClose={() => setShowExportModal(false)} />
      )}

      {/* 店舗追加モーダル */}
      {showAdd && (
        <div className={styles.overlay} onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>認定店を追加</h3>
            <p className={styles.mapIdNote}>
              💡 地図のピンは <strong>Google マイマップ</strong> 上で直接追加してください。ここではリスト情報のみ登録します。
            </p>
            <div className={styles.formGrid}>
              <div><label className={styles.label}>店名 *</label><input className={styles.input} value={form.name} onChange={setF('name')} placeholder="店名"/></div>
              <div><label className={styles.label}>年度 *</label><input className={styles.input} type="number" value={form.year} onChange={setF('year')}/></div>
              <div><label className={styles.label}>都道府県</label><input className={styles.input} value={form.prefecture} onChange={setF('prefecture')} placeholder="例: 東京"/></div>
              <div><label className={styles.label}>エリア</label>
                <select className={styles.input} value={form.area} onChange={setF('area')}>
                  <option value="">選択…</option>{AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div><label className={styles.label}>カテゴリ</label>
                <select className={styles.input} value={form.category} onChange={setF('category')}>
                  <option value="prestige">プレステージ</option>
                  <option value="authentic">オーセンティック</option>
                  <option value="casual">カジュアル</option>
                </select>
              </div>
              <div><label className={styles.label}>住所</label><input className={styles.input} value={form.address} onChange={setF('address')} placeholder="例: 大阪府大阪市西区…"/></div>
            </div>
            <label className={styles.label}>公式URL</label>
            <input className={styles.input} value={form.url} onChange={setF('url')} placeholder="https://…"/>
            <label className={styles.label}>メモ</label>
            <textarea className={styles.input} rows={2} value={form.note} onChange={setF('note')} placeholder="おすすめポイントなど…"/>
            <div style={{ display:'flex', gap:16, margin:'8px 0' }}>
              <label className={styles.checkLabel}><input type="checkbox" checked={form.is_new} onChange={e => setForm(f=>({...f,is_new:e.target.checked}))}/> 新規認定店</label>
              <label className={styles.checkLabel}><input type="checkbox" checked={form.is_award} onChange={e => setForm(f=>({...f,is_award:e.target.checked}))}/> 永年表彰店</label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowAdd(false)}>キャンセル</button>
              <button className={styles.saveBtn} onClick={addShop} disabled={saving}>{saving ? '追加中…' : '追加'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 一括インポート */}
      {bulkMode && (
        <div className={styles.overlay} onClick={e => e.target===e.currentTarget && setBulkMode(false)}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>一括インポート</h3>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <label className={styles.label} style={{ margin:0 }}>年度:</label>
              <input className={styles.input} style={{ width:100 }} type="number" value={bulkYear} onChange={e => setBulkYear(+e.target.value)}/>
            </div>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>
              タブ区切り: 店名・都道府県・エリア・カテゴリ・住所・URL
            </p>
            <textarea className={styles.input} rows={10} value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder={'店名\t都道府県\tエリア\tカテゴリ\t住所\tURL\n...'} style={{ fontFamily:'monospace', fontSize:12 }}/>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setBulkMode(false)}>キャンセル</button>
              <button className={styles.saveBtn} onClick={bulkImport} disabled={saving}>{saving ? 'インポート中…' : 'インポート実行'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
