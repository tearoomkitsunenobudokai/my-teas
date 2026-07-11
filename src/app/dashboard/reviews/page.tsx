'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { ReviewScores, SCORE_LABELS, SCORE_DESCRIPTIONS } from '@/types'
import { isCommentClean } from '@/lib/moderation'
import { summarizeReview, SummaryTone } from '@/lib/reviewSummary'
import { generateTeaCard, downloadBlob } from '@/lib/teaCard'
import TeaCup from '@/components/TeaCup'
import styles from './reviews.module.css'

const RadarChart = dynamic(() => import('@/components/charts/RadarChart'), { ssr: false })

const INIT_SCORES: ReviewScores = { score_aroma: 3, score_astringency: 3, score_richness: 3, score_sweetness: 3 }
const BREW_METHODS = ['リーフ','ティーバッグ','手鍋','粉末','希釈液','不明']
const ACCOMPANIMENTS = ['蜂蜜','ミルク','砂糖','アイス（グラス）']
const MAX_AROMA = 3
const MAX_COMMENT = 300

function hexToRgba(hex: string, a = 0.78): string {
  const h = (hex ?? '').replace('#','').slice(0,6)
  if (h.length === 6) return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
  return `rgba(200,169,110,${a})`
}
function fmtDate(d?: string) { return d ? d.slice(0,10).replace(/-/g,'/') : '' }

// 水色カップの描画は共通コンポーネント @/components/TeaCup を使用

// ─── タイル ───────────────────────────────────────
function ReviewTile({ r, onEdit, onDelete }: { r: any; onEdit: () => void; onDelete: () => void }) {
  const scores: ReviewScores = {
    score_aroma: r.score_aroma ?? 3, score_astringency: r.score_astringency ?? 3,
    score_richness: r.score_richness ?? 3, score_sweetness: r.score_sweetness ?? 3,
  }

  return (
    <div className={styles.tile}>
      <div className={styles.tileTop}>
        <div className={styles.tileNameRow}>
          <span className={styles.tileName}>{r.tea_name ?? '不明'}</span>
          <span className={styles.tileDate}>{fmtDate(r.drank_at ?? r.created_at?.slice(0,10))}</span>
          {r.is_public && <span>🌐</span>}
        </div>
        <div className={styles.tileMeta}>
          {r.brand_name
            ? <span className={styles.tileBrand}>🏷 {r.brand_name}</span>
            : <span className={styles.tilePlaceholder}>🏷 ブランド未設定</span>}
          {r.shop_name
            ? <span className={styles.tileSub}>🏪 {r.shop_name}</span>
            : <span className={styles.tilePlaceholder}>🏪 店舗未設定</span>}
        </div>
      </div>
      <div className={styles.tileBody}>
        <div className={styles.tileLeft}>
          <TeaCup hex={r.color_hex} size={72}/>
          {(r.aroma_notes ?? []).length > 0 && (
            <div className={styles.aromaTags}>
              {(r.aroma_notes as string[]).slice(0,3).map(n => <span key={n} className={styles.aromaTag}>{n}</span>)}
            </div>
          )}
        </div>
        <div className={styles.tileRight}><RadarChart scores={scores} size={155}/></div>
      </div>

      <div className={styles.tileActions}>
        <button className={styles.editBtn} onClick={onEdit}>✏️ 編集</button>
        <button className={styles.delBtn} onClick={onDelete}>🗑 削除</button>
      </div>
    </div>
  )
}

// ─── 評価入力モーダル ─────────────────────────────
function Modal({ userId, initial, costNormal, costOjou, costCard, onClose, onSaved }: {
  userId: string; initial?: any; costNormal: number; costOjou: number; costCard: number; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!initial

  const [teaName,   setTeaName]   = useState(initial?.tea_name ?? '')
  const [brandName, setBrandName] = useState(initial?.brand_name ?? '')
  const [shopName,  setShopName]  = useState(initial?.shop_name ?? '')
  const [colorHex,  setColorHex]  = useState(initial?.color_hex ?? '')
  const [aromaNotes,setAromaNotes]= useState<string[]>(initial?.aroma_notes ?? [])
  const [scores,    setScores]    = useState<ReviewScores>(isEdit
    ? { score_aroma: initial.score_aroma??3, score_astringency: initial.score_astringency??3,
        score_richness: initial.score_richness??3, score_sweetness: initial.score_sweetness??3 }
    : INIT_SCORES)
  const [comment,   setComment]   = useState(initial?.comment ?? '')
  const [isPublic,  setIsPublic]  = useState(initial?.is_public ?? false)
  const [drankAt,   setDrankAt]   = useState(initial?.drank_at ?? new Date().toISOString().slice(0,10))
  const [brewMethod,setBrewMethod]= useState(initial?.brew_method ?? '')
  const [steepSec,  setSteepSec]  = useState(initial?.steep_seconds ? String(initial.steep_seconds) : '')
  const [teaGrams,  setTeaGrams]  = useState(initial?.tea_grams_per_100ml ? String(initial.tea_grams_per_100ml) : '')
  const [accs,      setAccs]      = useState<string[]>(initial?.accompaniments ?? [])

  // AI要約（通常/お嬢様風）。既存の保存済み要約があれば復元。
  const [summaryNormal, setSummaryNormal] = useState<string | null>(initial?.summary_normal ?? null)
  const [summaryOjou,   setSummaryOjou]   = useState<string | null>(initial?.summary_ojou ?? null)
  const [summarizing,   setSummarizing]   = useState<SummaryTone | null>(null)
  const [copiedTone,    setCopiedTone]    = useState<SummaryTone | null>(null)

  async function runSummary(tone: SummaryTone) {
    if (!isEdit) return
    const cost = tone === 'ojou' ? costOjou : costNormal
    const already = tone === 'ojou' ? summaryOjou : summaryNormal
    const confirmMsg = already
      ? `${cost}ptを消費して再生成します。既存の要約は上書きされます。よろしいですか？`
      : `${cost}ptを消費して要約を生成します。よろしいですか？`
    if (!confirm(confirmMsg)) return
    setSummarizing(tone)
    try {
      // ポイント消費（製作者/管理者は消費なし判定）。失敗時は生成しない。
      const { data: consumed, error } = await supabase.rpc('consume_points', {
        p_amount: cost, p_feature: tone === 'ojou' ? 'summary_ojou' : 'summary',
      })
      if (error) { alert(error.message); return }
      const row = Array.isArray(consumed) ? consumed[0] : consumed
      if (row && row.success === false) { alert(row.message || 'ポイントが不足しています'); return }

      const text = await summarizeReview(initial, tone)

      // ポイントは既に消費済みのため、生成結果は即座にDBへ保存する
      // （このモーダルの「保存」ボタンを押さなくても消えないようにする）
      const col = tone === 'ojou' ? 'summary_ojou' : 'summary_normal'
      const { error: saveErr } = await supabase.from('reviews').update({ [col]: text }).eq('id', initial.id)
      if (saveErr) { alert('要約は生成されましたが保存に失敗しました: ' + saveErr.message); return }

      if (tone === 'ojou') setSummaryOjou(text); else setSummaryNormal(text)
    } catch (e: any) {
      alert(e?.message ?? '要約の生成に失敗しました')
    } finally {
      setSummarizing(null)
    }
  }

  async function copySummary(tone: SummaryTone) {
    const text = tone === 'ojou' ? summaryOjou : summaryNormal
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTone(tone)
      setTimeout(() => setCopiedTone(null), 1500)
    } catch {
      alert('コピーに失敗しました。手動で選択してコピーしてください。')
    }
  }

  const [makingCard, setMakingCard] = useState(false)
  const [cardSource, setCardSource] = useState<'memo' | 'normal' | 'ojou'>('memo')

  async function makeCard() {
    if (!isEdit) return
    if (!confirm(`${costCard}ptを消費して評価カード画像を作成します。よろしいですか？`)) return
    setMakingCard(true)
    try {
      const { data: consumed, error } = await supabase.rpc('consume_points', {
        p_amount: costCard, p_feature: 'tea_card',
      })
      if (error) { alert(error.message); return }
      const row = Array.isArray(consumed) ? consumed[0] : consumed
      if (row && row.success === false) { alert(row.message || 'ポイントが不足しています'); return }

      // カードに載せる名前（プロフィール名）を取得
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).single()

      // 選択された文章ソース（メモ / AI要約 / お嬢様風）
      const cardText =
        cardSource === 'normal' && summaryNormal ? summaryNormal :
        cardSource === 'ojou' && summaryOjou ? summaryOjou :
        comment

      const blob = await generateTeaCard({
        tea_name: teaName, brand_name: brandName, shop_name: shopName,
        user_name: profile?.name ?? null, color_hex: colorHex,
        comment: cardText, aroma_notes: aromaNotes, brew_method: brewMethod,
        steep_seconds: steepSec ? parseInt(steepSec) : null,
        tea_grams_per_100ml: teaGrams ? parseFloat(teaGrams) : null,
        accompaniments: accs,
        score_aroma: scores.score_aroma, score_astringency: scores.score_astringency,
        score_richness: scores.score_richness, score_sweetness: scores.score_sweetness,
      })
      downloadBlob(blob, `${(teaName || 'tea').replace(/[/\\?%*:|"<>]/g, '_')}_card.png`)
    } catch (e: any) {
      alert(e?.message ?? 'カードの作成に失敗しました')
    } finally {
      setMakingCard(false)
    }
  }

  const [colors,      setColors]      = useState<any[]>([])
  const [presets,     setPresets]     = useState<any[]>([])
  const [shops,       setShops]       = useState<any[]>([])
  const [pastBrands,  setPastBrands]  = useState<string[]>([])
  const [openGroup,   setOpenGroup]   = useState<string|null>(null)
  const [showColors,  setShowColors]  = useState(false)
  const [showDetail,  setShowDetail]  = useState(false)
  const [shopInput,   setShopInput]   = useState(initial?.shop_name ?? '')
  const [showShops,   setShowShops]   = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('tea_colors').select('hex,name').order('is_official',{ascending:false}).order('sort_order')
      .then(({data}) => setColors(data ?? []))
    supabase.from('aroma_presets').select('group_name,items').order('sort_order')
      .then(({data}) => setPresets(data ?? []))
    supabase.from('certified_shop_masters').select('id,name,prefecture').order('name')
      .then(({data}) => {
        setShops(data ?? [])
        // 編集時、既存の店名が認定店と一致すればIDを復元しておく
        if (initial?.shop_name) {
          const m = (data ?? []).find((s:any) => s.name === initial.shop_name)
          if (m) setSelectedShopId(m.id)
        }
      })
    supabase.from('reviews').select('brand_name').eq('user_id', userId).not('brand_name','is',null)
      .then(({data}) => {
        const unique = Array.from(new Set((data ?? []).map((r:any) => r.brand_name).filter(Boolean))) as string[]
        setPastBrands(unique.sort())
      })
  }, [supabase, userId])

  const colorName = colors.find(c => c.hex === colorHex)?.name
  const filteredShops = shopInput.length >= 1
    ? shops.filter(s => s.name.includes(shopInput) || s.prefecture?.includes(shopInput)).slice(0,6)
    : []

  function toggleAroma(n: string) {
    if (aromaNotes.includes(n)) { setAromaNotes(a => a.filter(x => x !== n)); return }
    if (aromaNotes.length >= MAX_AROMA) { alert(`香りは${MAX_AROMA}つまでです`); return }
    setAromaNotes(a => [...a, n])
  }

  async function save() {
    if (!teaName.trim()) { alert('お茶の名前を入力してください'); return }
    setSaving(true)

    // 新規登録時のみ上限チェック（権限区分ごとの上限を適用）
    if (!isEdit) {
      const [{ data: limitVal }, { count }] = await Promise.all([
        supabase.rpc('get_my_limit', { p_feature: 'reviews' }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ])
      const limit = typeof limitVal === 'number' ? limitVal : 0
      if (limit > 0 && (count ?? 0) >= limit) {
        alert(`評価の登録上限（${limit}件）に達しています。\n管理者にお問い合わせください。`)
        setSaving(false); return
      }
    }

    // コメントの不適切表現チェック。
    // NGワードがある場合、保存は許可するがコミュニティ公開（is_public）はできない。
    let effectiveIsPublic = isPublic
    if (isPublic) {
      const check = isCommentClean(comment)
      if (!check.clean) {
        effectiveIsPublic = false
        alert('コメントに不適切な表現が含まれている可能性があるため、非公開で保存します。\n（コミュニティには公開されません。表現を見直すと公開できます）')
      }
    }

    // 公開件数の上限チェック（区分ごと・月次）。
    // 「公開操作」= 新規で公開 / 非公開だったものを公開に切り替え、のいずれか。
    // 既に公開済みのものを公開のまま保存する場合は新たな公開操作ではないので数えない。
    const isNewPublishAction = effectiveIsPublic && !(isEdit && initial?.is_public)
    if (isNewPublishAction) {
      const [{ data: pubLimitVal }, { data: monthCount }] = await Promise.all([
        supabase.rpc('get_my_limit', { p_feature: 'public' }),
        supabase.rpc('count_my_publishes_this_month'),
      ])
      const pubLimit = typeof pubLimitVal === 'number' ? pubLimitVal : 0
      const used = typeof monthCount === 'number' ? monthCount : 0
      if (pubLimit > 0 && used >= pubLimit) {
        effectiveIsPublic = false
        alert(`今月コミュニティに公開できる件数の上限（${pubLimit}件）に達しているため、非公開で保存します。\n公開できる件数は翌月にリセットされます。`)
      }
    }
    // 実際に公開操作が成立したか（上限で非公開に落とされた場合は false）
    const didPublish = effectiveIsPublic && !(isEdit && initial?.is_public)

    const p: any = {
      user_id: userId, tea_name: teaName.trim(),
      brand_name: brandName.trim() || null,
      shop_name: shopName || null, color_hex: colorHex || null,
      aroma_notes: aromaNotes.length ? aromaNotes : null,
      ...scores, comment: comment || null, is_public: effectiveIsPublic, drank_at: drankAt,
      brew_method: brewMethod || null,
      steep_seconds: steepSec ? parseInt(steepSec) : null,
      tea_grams_per_100ml: teaGrams ? parseFloat(teaGrams) : null,
      accompaniments: accs.length ? accs : null,
    }
    const { data: saved, error } = isEdit
      ? await supabase.from('reviews').update(p).eq('id', initial.id).select('id').single()
      : await supabase.from('reviews').insert(p).select('id').single()
    setSaving(false)
    if (error) { alert(error.message); return }
    // 公開操作が成立したら、月次カウント用のログを記録する
    if (didPublish && saved?.id) {
      await supabase.from('review_publish_log').insert({ user_id: userId, review_id: saved.id })
    }
    // 認定店を選んで評価した場合、その店を自動で「訪問済み」にする
    // （既に訪問済みなら重複させない。手入力の店名や認定店以外は対象外）
    if (selectedShopId) {
      const { data: existing } = await supabase.from('shop_visits')
        .select('id').eq('user_id', userId).eq('shop_id', selectedShopId).maybeSingle()
      if (!existing) {
        await supabase.from('shop_visits').insert({ user_id: userId, shop_id: selectedShopId })
      }
    }
    onSaved(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* ヘッダー */}
        <div className={styles.mHead}>
          <h3 className={styles.mTitle}>{isEdit ? '✏️ 評価を編集' : '☕ 評価を登録'}</h3>
          <button className={styles.mClose} onClick={onClose}>✕</button>
        </div>

        {/* お茶の名前（必須） */}
        <label className={styles.label}>☕ お茶の名前 <span className={styles.req}>*</span></label>
        <input className={styles.input} value={teaName} onChange={e => setTeaName(e.target.value)}
          placeholder="例: ダージリン ファーストフラッシュ"/>

        {/* ブランド名 */}
        <label className={styles.label}>🏷 ブランド名</label>
        <input className={styles.input} value={brandName} onChange={e => setBrandName(e.target.value)}
          placeholder="例: Harney & Sons、ルピシア、Fortnum & Mason"
          list="brand-suggestions"/>
        <datalist id="brand-suggestions">
          {pastBrands.map(b => <option key={b} value={b}/>)}
        </datalist>

        {/* 水色 + レーダーチャート横並び */}
        <div className={styles.rowTwo}>
          {/* 水色 */}
          <div className={styles.colorBlock}>
            <p className={styles.label}>🍵 水色</p>
            <TeaCup hex={colorHex} size={72}/>
            {colorName && <p className={styles.colorName}>{colorName}</p>}
            <button className={styles.pickBtn} onClick={() => setShowColors(v=>!v)}>
              {showColors ? '▲ 閉じる' : '🎨 選択'}
            </button>
            {showColors && (
              <div className={styles.dots}>
                {colors.map(c => (
                  <button key={c.hex} title={c.name}
                    className={`${styles.dot} ${colorHex===c.hex ? styles.dotOn:''}`}
                    style={{ background: hexToRgba(c.hex, 0.85) }}
                    onClick={() => { setColorHex(c.hex); setShowColors(false) }}/>
                ))}
              </div>
            )}
            {/* カスタムカラー入力 */}
            <div className={styles.customColorRow}>
              <input type="color"
                value={'#' + (colorHex.replace('#','').slice(0,6) || 'C8A96E')}
                onChange={e => {
                  const hex6 = e.target.value // #RRGGBB
                  const alpha = colorHex.length === 9 ? colorHex.slice(7) : 'B0'
                  setColorHex(hex6 + alpha)
                }}
                className={styles.colorInput}
                title="カスタムカラーを選択"/>
              <span className={styles.customColorLabel}>カスタム</span>
            </div>
          </div>
          {/* チャート */}
          <div className={styles.chartBlock}>
            <p className={styles.label}>📊 評価スコア</p>
            <RadarChart scores={scores} size={160}/>
            <div className={styles.sliders}>
              {(Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]).map(k => (
                <div key={k} className={styles.slRow}>
                  <span className={styles.slLabel}>{SCORE_LABELS[k]}</span>
                  <span className={styles.slEdge}>{SCORE_DESCRIPTIONS[k].weak}</span>
                  <input type="range" min={1} max={5} step={1} value={scores[k]}
                    onChange={e => setScores(s=>({...s,[k]:+e.target.value}))}
                    className={styles.slider}/>
                  <span className={styles.slEdge}>{SCORE_DESCRIPTIONS[k].strong}</span>
                  <span className={styles.slVal}>{scores[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 香り分析 */}
        <p className={styles.label}>🌸 香り分析 <span className={styles.sub}>({aromaNotes.length}/{MAX_AROMA})</span></p>
        {aromaNotes.length > 0 && (
          <div className={styles.selectedAroma}>
            {aromaNotes.map(n => (
              <span key={n} className={styles.aromaSelected}>
                {n}<button onClick={() => setAromaNotes(a=>a.filter(x=>x!==n))}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.groups}>
          {presets.map(g => (
            <div key={g.group_name} className={styles.group}>
              <button className={`${styles.groupBtn} ${openGroup===g.group_name?styles.groupBtnOn:''}`}
                onClick={() => setOpenGroup(openGroup===g.group_name?null:g.group_name)}>
                {g.group_name} {openGroup===g.group_name?'▲':'▼'}
              </button>
              {openGroup===g.group_name && (
                <div className={styles.groupItems}>
                  {g.items.map((item:string) => (
                    <button key={item}
                      className={`${styles.aromaChip} ${aromaNotes.includes(item)?styles.aromaChipOn:''}`}
                      onClick={() => toggleAroma(item)}>
                      {item}{aromaNotes.includes(item) && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 飲んだ場所 */}
        <label className={styles.label}>🏪 飲んだ場所</label>
        <div className={styles.suggestWrap}>
          <input className={styles.input} value={shopInput}
            onChange={e => { setShopInput(e.target.value); setShopName(e.target.value); setSelectedShopId(null); setShowShops(true) }}
            onBlur={() => setTimeout(() => setShowShops(false), 150)}
            placeholder="店名を入力、または認定店リストから選択"/>
          {showShops && filteredShops.length > 0 && (
            <div className={styles.suggestBox}>
              {filteredShops.map(s => (
                <div key={s.id} className={styles.suggestRow}
                  onMouseDown={() => { setShopName(s.name); setShopInput(s.name); setSelectedShopId(s.id); setShowShops(false) }}>
                  <span className={styles.suggestName}>{s.name}</span>
                  <span className={styles.suggestPref}>{s.prefecture}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedShopId && <p className={styles.shopHint}>✅ 認定店として登録され、「訪問済み」に自動で追加されます</p>}

        <label className={styles.label}>📅 飲んだ日</label>
        <input type="date" className={styles.inputDate} value={drankAt} onChange={e => setDrankAt(e.target.value)}/>
        <label className={styles.label}>💬 コメント <span className={styles.sub}>({comment.length}/{MAX_COMMENT})</span></label>
        <textarea className={styles.textarea} rows={2} value={comment} maxLength={MAX_COMMENT}
          onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))} placeholder="感想・メモ…"/>

        {/* AI要約（編集時のみ表示。新規登録時はまず保存してから利用可能） */}
        {isEdit ? (
          <div className={styles.summaryEditBlock}>
            <div className={styles.summaryRow}>
              <button type="button" className={styles.summaryBtn} disabled={summarizing !== null}
                onClick={() => runSummary('normal')}>
                {summarizing === 'normal' ? '生成中…' : `📝 まとめる（${costNormal}pt）`}
              </button>
              <button type="button" className={`${styles.summaryBtn} ${styles.summaryBtnOjou}`} disabled={summarizing !== null}
                onClick={() => runSummary('ojou')}>
                {summarizing === 'ojou' ? '生成中…' : `🎀 お嬢様風（${costOjou}pt）`}
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              {(summaryNormal || summaryOjou) && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    カードに載せる文章
                  </label>
                  <select className={styles.input} value={cardSource}
                    onChange={e => setCardSource(e.target.value as any)}
                    style={{ fontSize: 13 }}>
                    <option value="memo">自分のメモ</option>
                    {summaryNormal && <option value="normal">📝 AI要約</option>}
                    {summaryOjou && <option value="ojou">🎀 お嬢様風の要約</option>}
                  </select>
                </div>
              )}
              <button type="button" className={styles.cardBtn} disabled={makingCard}
                onClick={makeCard}>
                {makingCard ? '作成中…' : `🖼️ 評価カード画像を作成（${costCard}pt）`}
              </button>
              <p className={styles.hint} style={{ marginTop: 4 }}>
                水色・スコア・香りノートなどをまとめた画像を作成し、ダウンロードします。
              </p>
            </div>

            {summaryNormal && (
              <div className={styles.summaryBubble}>
                <div className={styles.summaryBubbleHead}>
                  <span className={styles.summaryTag}>📝 AI要約</span>
                  <button type="button" className={styles.copyBtn} onClick={() => copySummary('normal')}>
                    {copiedTone === 'normal' ? '✅ コピーしました' : '📋 コピー'}
                  </button>
                </div>
                <p className={styles.summaryText}>{summaryNormal}</p>
              </div>
            )}
            {summaryOjou && (
              <div className={`${styles.summaryBubble} ${styles.summaryBubbleOjou}`}>
                <div className={styles.summaryBubbleHead}>
                  <span className={styles.summaryTag}>🎀 お嬢様風の要約</span>
                  <button type="button" className={styles.copyBtn} onClick={() => copySummary('ojou')}>
                    {copiedTone === 'ojou' ? '✅ コピーしました' : '📋 コピー'}
                  </button>
                </div>
                <p className={styles.summaryText}>{summaryOjou}</p>
              </div>
            )}
          </div>
        ) : (
          <p className={styles.hint}>💡 AI要約は評価を保存した後、編集画面から利用できます</p>
        )}

        <label className={styles.checkLabel}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}/>
          コミュニティに公開する
        </label>

        {/* 詳細情報（折りたたみ） */}
        <button className={styles.detailToggle} onClick={() => setShowDetail(v=>!v)}>
          {showDetail ? '▲ 詳細を閉じる' : '▼ 詳細情報（淹れ方・添え物）'}
        </button>
        {showDetail && (
          <div className={styles.detail}>
            <p className={styles.label}>抽出方法</p>
            <div className={styles.chips}>
              {BREW_METHODS.map(m => (
                <button key={m} className={`${styles.chip} ${brewMethod===m?styles.chipOn:''}`}
                  onClick={() => setBrewMethod(brewMethod===m?'':m)}>{m}</button>
              ))}
            </div>
            <div className={styles.detailRow}>
              <div>
                <p className={styles.label}>淹れ時間（秒）</p>
                <input className={styles.inputSm} type="number" value={steepSec}
                  onChange={e => setSteepSec(e.target.value)} placeholder="例: 180"/>
              </div>
              <div>
                <p className={styles.label}>茶葉量（g/100ml）</p>
                <input className={styles.inputSm} type="number" step="0.1" min="0" value={teaGrams}
                  onChange={e => setTeaGrams(e.target.value)} placeholder="例: 2.5"/>
              </div>
            </div>
            <p className={styles.label}>添え物</p>
            <div className={styles.chips}>
              {ACCOMPANIMENTS.map(a => (
                <button key={a} className={`${styles.chip} ${accs.includes(a)?styles.chipOn:''}`}
                  onClick={() => setAccs(p => p.includes(a)?p.filter(x=>x!==a):[...p,a])}>{a}</button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.mFoot}>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
          <button className={styles.saveBtn} onClick={save} disabled={saving||!teaName.trim()}>
            {saving?'保存中…':isEdit?'更新する':'評価を登録'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── メインページ ─────────────────────────────────
export default function ReviewsPage() {
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [userId,  setUserId]  = useState('')
  const [loading, setLoading] = useState(true)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')
  const [filterPub,  setFilterPub]  = useState<'all'|'public'|'private'>('all')
  const [sort,       setSort]       = useState<'desc'|'asc'>('desc')
  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [canExport,  setCanExport]  = useState(false)
  const [costNormal, setCostNormal] = useState(1)
  const [costOjou,   setCostOjou]   = useState(1)
  const [costCard,   setCostCard]   = useState(1)

  useEffect(() => {
    const sb = createClient()
    sb.rpc('get_feature_cost', { p_feature: 'summary' }).then(({ data }) => { if (typeof data === 'number') setCostNormal(data) })
    sb.rpc('get_feature_cost', { p_feature: 'summary_ojou' }).then(({ data }) => { if (typeof data === 'number') setCostOjou(data) })
    sb.rpc('get_feature_cost', { p_feature: 'tea_card' }).then(({ data }) => { if (typeof data === 'number') setCostCard(data) })
  }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('reviews')
        .select('id,tea_name,brand_name,shop_name,color_hex,aroma_notes,score_aroma,score_astringency,score_richness,score_sweetness,comment,is_public,drank_at,created_at,steep_seconds,brew_method,tea_grams_per_100ml,accompaniments,summary_normal,summary_ojou')
        .eq('user_id', user.id).order('drank_at', { ascending: false }),
      supabase.from('profiles').select('is_subscribed,is_admin,is_creator').eq('id', user.id).single(),
    ])
    setReviews(data ?? [])
    // 課金ユーザー・管理者・製作者はエクスポート可能
    setCanExport(!!(profile?.is_subscribed || profile?.is_admin || profile?.is_creator))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function del(id: string) {
    if (!confirm('この評価を削除しますか？')) return
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(rs => rs.filter(r => r.id !== id))
  }

  function exportCsv() {
    // CSVの1セルを安全にエスケープ（カンマ・改行・引用符対応）
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const headers = [
      '飲んだ日', '紅茶名', 'ブランド', '認定店', '色',
      '香り', '渋み', 'コク', '甘み',
      '抽出方法', '淹れ時間(秒)', '茶葉量(g/100ml)', '添え物',
      'コメント', '公開', '登録日時',
    ]
    const rows = reviews.map(r => [
      r.drank_at ?? r.created_at?.slice(0, 10) ?? '',
      r.tea_name ?? '',
      r.brand_name ?? '',
      r.shop_name ?? '',
      r.color_hex ?? '',
      r.score_aroma ?? '', r.score_astringency ?? '', r.score_richness ?? '', r.score_sweetness ?? '',
      r.brew_method ?? '',
      r.steep_seconds ?? '',
      r.tea_grams_per_100ml ?? '',
      Array.isArray(r.accompaniments) ? r.accompaniments.join('・') : '',
      r.comment ?? '',
      r.is_public ? '公開' : '非公開',
      r.created_at ?? '',
    ].map(esc).join(','))

    // Excelで文字化けしないよう BOM を付与
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `teanote_reviews_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const list = reviews.filter(r => {
    const d = r.drank_at ?? r.created_at?.slice(0,10) ?? ''
    if (filterFrom && d < filterFrom) return false
    if (filterTo   && d > filterTo)   return false
    if (filterPub === 'public'  && !r.is_public) return false
    if (filterPub === 'private' &&  r.is_public) return false
    return true
  }).sort((a,b) => {
    const da = a.drank_at ?? a.created_at ?? '', db = b.drank_at ?? b.created_at ?? ''
    return sort==='desc' ? db.localeCompare(da) : da.localeCompare(db)
  })

  return (
    <div className={styles.page}>
      <div className={styles.ph}>
        <h1 className={styles.title}>⭐ 自分の評価</h1>
        <div className={styles.phActions}>
          {canExport && reviews.length > 0 && (
            <button className={styles.exportBtn} onClick={exportCsv} title="自分の全評価をCSVでダウンロード">
              ⬇ CSVエクスポート
            </button>
          )}
          <button className={styles.regBtn} onClick={() => { setEditTarget(null); setShowModal(true) }}>
            + 新しく評価を登録
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.fg}>
          <span className={styles.fl}>飲んだ日</span>
          <input type="date" className={styles.di} value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/>
          <span className={styles.fl}>〜</span>
          <input type="date" className={styles.di} value={filterTo} onChange={e=>setFilterTo(e.target.value)}/>
          {(filterFrom||filterTo) && <button className={styles.clr} onClick={()=>{setFilterFrom('');setFilterTo('')}}>✕</button>}
        </div>
        <div className={styles.pfg}>
          {(['all','public','private'] as const).map(v => (
            <button key={v} className={`${styles.pfb} ${filterPub===v?styles.pfbOn:''}`}
              onClick={() => setFilterPub(v)}>
              {v==='all'?'すべて':v==='public'?'🌐 公開':'🔒 非公開'}
            </button>
          ))}
        </div>
        <select className={styles.sortSel} value={sort} onChange={e=>setSort(e.target.value as 'desc'|'asc')}>
          <option value="desc">新しい順</option><option value="asc">古い順</option>
        </select>
        <span className={styles.cnt}>{list.length}件</span>
      </div>

      {loading ? <p className={styles.hint}>読み込み中…</p>
      : list.length === 0 ? (
        <div className={styles.empty}>
          <p>評価がまだありません</p>
          <button className={styles.regBtn} onClick={()=>setShowModal(true)}>+ 最初の評価を登録</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {list.map(r => (
            <ReviewTile key={r.id} r={r}
              onEdit={() => { setEditTarget(r); setShowModal(true) }}
              onDelete={() => del(r.id)}/>
          ))}
        </div>
      )}

      {showModal && (
        <Modal userId={userId} initial={editTarget??undefined}
          costNormal={costNormal} costOjou={costOjou} costCard={costCard}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSaved={() => { setShowModal(false); setEditTarget(null); load() }}/>
      )}
    </div>
  )
}
