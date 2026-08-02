'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { ReviewScores } from '@/types'
import TeaCupSvg from '@/components/TeaCup'
import styles from './community.module.css'

const RadarChart = dynamic(() => import('@/components/charts/RadarChart'), { ssr: false })

const DEFAULT_MAX_WANTS = 10  // 設定が取得できない場合のフォールバック

function formatLocation(p: any): string | null {
  if (!p || p.location_visibility === 'private') return null
  if (p.location_visibility === 'prefecture' && p.location_prefecture)
    return `${p.location_prefecture}（${p.location_area ?? ''}）`
  return p.location_area ?? null
}

function hexToRgba(hex: string, a = 0.78): string {
  const h = (hex ?? '').replace('#', '')
  if (h.length >= 6) return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`
  return `rgba(200,169,110,${a})`
}
function fmtDate(d?: string) { return d ? d.slice(0,10).replace(/-/g,'/') : '' }

// 水色カップの描画は共通コンポーネント @/components/TeaCup を使用

// ─── コミュニティタイル ───────────────────────────
function CommunityTile({ review, onClick, isWanted, onToggleWant, canWant }:
  { review: any; onClick: () => void; isWanted: boolean; onToggleWant: () => void; canWant: boolean }) {
  // reviews.tea_name 優先、なければ teas.name
  const teaName = review.tea_name ?? '不明'
  const aroma: string[] = review.aroma_notes ?? []
  // 飲み方（＝添え物: なし（ストレート）・ミルク・砂糖・レモン 等）
  const accompaniments: string[] = review.accompaniments ?? []
  // reviews.color_hex 優先、なければ teas.color_hex
  const colorHex = review.color_hex
  const scores: ReviewScores = {
    score_aroma:       review.score_aroma       ?? 3,
    score_astringency: review.score_astringency ?? 3,
    score_richness:    review.score_richness    ?? 3,
    score_color_depth: review.score_color_depth ?? 3,
  }
  return (
    <div className={styles.tile} onClick={onClick}>
      {/* タイル上部：茶葉名・ブランド・お店 */}
      <div className={styles.tileHeader}>
        <div className={styles.tileNameRow}>
          <span className={styles.tileName}>{teaName}</span>
          <span className={styles.tileDate}>{fmtDate(review.drank_at ?? review.created_at?.slice(0,10))}</span>
        </div>
        <div className={styles.tileMeta}>
          {review.brand_name
            ? <span className={styles.tileBrand}>🏷 {review.brand_name}</span>
            : <span className={styles.tilePlaceholder}>🏷 ブランド未設定</span>}
          {review.shop_name
            ? <span className={styles.tileShop}>🏪 {review.shop_name}</span>
            : <span className={styles.tilePlaceholder}>🏪 店舗未設定</span>}
          {review.tea_garden && <span className={styles.tileShop}>🌱 {review.tea_garden}</span>}
        </div>
      </div>
      {/* タイル本体：各カラムに見出しを付けた4カラム（水色 / 香り / チャート / 添え物） */}
      <div className={styles.tileBody}>
        {/* 水色 */}
        <div className={styles.tileCol}>
          <span className={styles.colLabel}>水色</span>
          <TeaCupSvg hex={colorHex} size={96}/>
        </div>
        {/* 香り */}
        <div className={styles.tileCol}>
          <span className={styles.colLabel}>香り</span>
          <div className={styles.colTags}>
            {aroma.length > 0
              ? aroma.slice(0,3).map((n:string) => <span key={n} className={styles.tileAromaTag}>{n}</span>)
              : <span className={styles.colEmpty}>—</span>}
          </div>
        </div>
        {/* チャート */}
        <div className={styles.tileColChart}>
          <span className={styles.colLabel}>チャート</span>
          <RadarChart scores={scores} size={150}/>
        </div>
        {/* 添え物 */}
        <div className={styles.tileCol}>
          <span className={styles.colLabel}>添え物</span>
          <div className={styles.colTags}>
            {accompaniments.length > 0
              ? accompaniments.map((a:string) => <span key={a} className={styles.tileAccompTag}>{a}</span>)
              : <span className={styles.colEmpty}>—</span>}
          </div>
        </div>
      </div>
      {/* 投稿者 */}
      <div className={styles.tileFooter}>
        <span className={styles.tileAuthor}>
          {review.profiles?.avatar_url
            ? <img src={review.profiles.avatar_url} alt="" className={styles.tileAuthorAvatar} />
            : '👤'} {review.profiles?.name ?? '匿名'}
        </span>
        {formatLocation(review.profiles) && <span className={styles.tileLocation}>📍 {formatLocation(review.profiles)}</span>}
        {canWant && (
          <button
            className={`${styles.tileWantBtn} ${isWanted ? styles.tileWantBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onToggleWant() }}
            title={isWanted ? '飲みたいを解除' : '飲みたいに追加'}>
            🍵 {isWanted ? '登録済み' : '飲みたい'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── メインページ ─────────────────────────────────
export default function CommunityPage() {
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date'|'score'>('date')
  const [showWantsOnly, setShowWantsOnly] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [wants, setWants] = useState<Set<string>>(new Set())
  const [maxWants, setMaxWants] = useState<number>(DEFAULT_MAX_WANTS)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('id, tea_name, brand_name, shop_name, tea_garden, color_hex, aroma_notes, user_id, score_aroma, score_astringency, score_richness, score_color_depth, comment, is_public, drank_at, created_at, brew_method, steep_seconds, tea_grams_per_100ml, accompaniments')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    const reviewRows = data ?? []
    // 投稿者のプロフィールは公開ビュー(public_profiles)から必要な列だけ取得してマージする
    // （profilesテーブルを直接JOINしないことで points/account_status 等の露出を防ぐ）
    const userIds = Array.from(new Set(reviewRows.map((r: any) => r.user_id).filter(Boolean)))
    let profileMap: Record<string, any> = {}
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('public_profiles')
        .select('id, name, bio, favorite_tea, location_area, location_prefecture, location_visibility, avatar_url')
        .in('id', userIds)
      for (const p of profs ?? []) profileMap[p.id] = p
    }
    setReviews(reviewRows.map((r: any) => ({ ...r, profiles: profileMap[r.user_id] ?? null })))

    // ログインユーザーと、その「飲みたい」登録を取得
    // getSession()はローカルのセッションを即時返す（getUser()のようなサーバー往復なし）
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    setUserId(user?.id ?? null)
    if (user) {
      const { data: myWants } = await supabase
        .from('review_wants').select('review_id').eq('user_id', user.id)
      setWants(new Set((myWants ?? []).map((w: any) => w.review_id)))
    }
    // 飲みたい上限（権限区分ごと）を取得
    const { data: limitVal } = await supabase.rpc('get_my_limit', { p_feature: 'wants' })
    if (typeof limitVal === 'number') setMaxWants(limitVal)
    setLoading(false)
  }, [supabase])

  async function toggleWant(reviewId: string) {
    if (!userId) return
    const has = wants.has(reviewId)
    if (has) {
      await supabase.from('review_wants').delete().eq('user_id', userId).eq('review_id', reviewId)
      setWants(prev => { const n = new Set(prev); n.delete(reviewId); return n })
    } else {
      if (maxWants > 0 && wants.size >= maxWants) {
        alert(`飲みたいリストは最大${maxWants}件です。\n他のお茶を解除してから追加してください。`)
        return
      }
      const { error } = await supabase.from('review_wants').insert({ user_id: userId, review_id: reviewId })
      if (error) { alert(error.message); return }
      setWants(prev => new Set(prev).add(reviewId))
    }
  }

  useEffect(() => { load() }, [load])

  const filtered = reviews
    .filter(r => {
      if (showWantsOnly && !wants.has(r.id)) return false
      if (search && !r.tea_name?.includes(search) && !r.profiles?.name?.includes(search)) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        const sa = (a.score_aroma+a.score_astringency+a.score_richness+a.score_color_depth)/4
        const sb = (b.score_aroma+b.score_astringency+b.score_richness+b.score_color_depth)/4
        return sb - sa
      }
      return (b.drank_at??b.created_at).localeCompare(a.drank_at??a.created_at)
    })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>👥 コミュニティ</h1>
        <span className={styles.subtitle}>みんなの評価を見る</span>
      </div>

      {/* フィルター */}
      <div className={styles.toolbar}>
        <input className={styles.searchInput} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="茶葉名・投稿者で検索…"/>
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value as 'date'|'score')}>
          <option value="date">新しい順</option>
          <option value="score">スコア順</option>
        </select>
        {userId && (
          <button
            className={`${styles.wantFilterBtn} ${showWantsOnly ? styles.wantFilterActive : ''}`}
            onClick={() => setShowWantsOnly(v => !v)}>
            🍵 飲みたい{wants.size > 0 ? `（${wants.size}）` : ''}
          </button>
        )}
        <span className={styles.countBadge}>{filtered.length}件</span>
      </div>

      {/* タイルグリッド */}
      {loading ? <p className={styles.hint}>読み込み中…</p>
      : filtered.length === 0 ? <p className={styles.hint}>{showWantsOnly ? '「飲みたい」に登録したお茶がまだありません' : 'まだ公開されている評価がありません'}</p>
      : (
        <div className={styles.tileGrid}>
          {filtered.map(r => <CommunityTile key={r.id} review={r}
            isWanted={wants.has(r.id)}
            onToggleWant={() => toggleWant(r.id)}
            canWant={!!userId}
            onClick={() => setSelected(selected?.id===r.id ? null : r)}/>)}
        </div>
      )}

      {/* 詳細モーダル */}
      {selected && (
        <div className={styles.overlay} onClick={e => e.target===e.currentTarget && setSelected(null)}>
          <div className={styles.detailModal}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.modalTitle}>{selected.tea_name ?? '不明'}</p>
                {selected.brand_name && <p className={styles.hint}>🏷 {selected.brand_name}</p>}
                {selected.shop_name && <p className={styles.hint}>🏪 {selected.shop_name}</p>}
                {selected.tea_garden && <p className={styles.hint}>🌱 {selected.tea_garden}</p>}
              </div>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className={styles.detailBody}>
              <div className={styles.detailLeft}>
                <p className={styles.detailSectionLabel}>水色</p>
                <TeaCupSvg hex={selected.color_hex} size={90}/>
                {(() => {
                    const notes = selected.aroma_notes ?? []
                    return notes.length > 0 ? (
                      <>
                        <p className={styles.detailSectionLabel} style={{marginTop:10}}>香り分析</p>
                        <div className={styles.tileAroma}>
                          {notes.map((n:string) => <span key={n} className={styles.tileAromaTag}>{n}</span>)}
                        </div>
                      </>
                    ) : null
                  })()}
              </div>
              <div className={styles.detailRight}>
                <RadarChart scores={{
                  score_aroma: selected.score_aroma??3,
                  score_astringency: selected.score_astringency??3,
                  score_richness: selected.score_richness??3,
                  score_color_depth: selected.score_color_depth??3,
                }} size={220}/>
              </div>
            </div>
            {selected.comment && <p className={styles.detailComment}>{selected.comment}</p>}

            {/* 飲みたいボタン（自分用ブックマーク・最大10件） */}
            <div className={styles.wantRow}>
              {userId && (
                <button
                  className={`${styles.wantBtn} ${wants.has(selected.id) ? styles.wantBtnActive : ''}`}
                  onClick={() => toggleWant(selected.id)}>
                  {wants.has(selected.id) ? '🍵 飲みたい登録済み' : '🍵 飲みたい'}
                </button>
              )}
            </div>

            {/* 詳細情報（入力されている項目のみ表示） */}
            {(selected.brew_method || selected.steep_seconds || selected.tea_grams_per_100ml || selected.accompaniments?.length > 0) && (
              <div className={styles.detailInfoRow}>
                {selected.brew_method && (
                  <span className={styles.detailInfoTag}>🍵 {selected.brew_method}</span>
                )}
                {selected.steep_seconds && (
                  <span className={styles.detailInfoTag}>⏱ {selected.steep_seconds}秒</span>
                )}
                {selected.tea_grams_per_100ml && (
                  <span className={styles.detailInfoTag}>⚖️ {selected.tea_grams_per_100ml}g/100ml</span>
                )}
                {selected.accompaniments?.map((a: string) => (
                  <span key={a} className={styles.detailInfoTag}>✨ {a}</span>
                ))}
              </div>
            )}
            {/* 投稿者情報 */}
            <div className={styles.authorPanel}>
              <div className={styles.authorAvatar}>
                {selected.profiles?.avatar_url
                  ? <img src={selected.profiles.avatar_url} alt="" className={styles.authorAvatarImg} />
                  : (selected.profiles?.name??'?').charAt(0)}
              </div>
              <div className={styles.authorInfo}>
                <p className={styles.authorName}>{selected.profiles?.name ?? '匿名'}</p>
                {formatLocation(selected.profiles) && <p className={styles.authorSub}>📍 {formatLocation(selected.profiles)}</p>}
                {selected.profiles?.bio && <p className={styles.authorBio}>{selected.profiles.bio}</p>}
              </div>
            </div>
            <div className={styles.detailMeta}>
              <span>飲んだ日: {fmtDate(selected.drank_at)}</span>
              <span>投稿日: {fmtDate(selected.created_at?.slice(0,10))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
