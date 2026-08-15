'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { ReviewScores } from '@/types'
import TeaCupSvg from '@/components/TeaCup'
import { formatGardenOrigin, formatLeafWater } from '@/lib/reviewFormat'
import { generateTeaCard } from '@/lib/teaCard'
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
          {formatGardenOrigin(review.tea_garden, review.origin_country) && <span className={styles.tileShop}>🌱 {formatGardenOrigin(review.tea_garden, review.origin_country)}</span>}
        </div>
      </div>
      {/* タイル本体：上段=水色/チャート、下段=香り・添え物（全幅で折り返しを防ぐ） */}
      <div className={styles.tileTable}>
        {/* ── 上段：水色 ｜ チャート ── */}
        <div className={styles.topRow}>
          <div className={styles.topCell}>
            <div className={styles.th}>水色</div>
            <div className={styles.cupBox}>
              <TeaCupSvg hex={colorHex} size={128} tight/>
              {colorHex && (
                <span className={styles.hexRow}>
                  {/* 評価カードと同じ、金の枠線付きの色見本 */}
                  <span className={styles.hexSwatch} style={{ background: colorHex }}/>
                  <span className={styles.hexCode}>{colorHex.toUpperCase()}</span>
                </span>
              )}
            </div>
          </div>
          <div className={`${styles.topCell} ${styles.colDiv}`}>
            <div className={styles.th}>チャート</div>
            <div className={styles.chartBox}>
              <RadarChart scores={scores} size={420} labelFontSize={20} tickFontSize={15} desktopLabelFontSize={12} desktopTickFontSize={10} fluid verticalSideLabels/>
            </div>
          </div>
        </div>
        {/* ── 下段：香り ── */}
        <div className={styles.attrRow}>
          <div className={styles.attrLabel}>香り</div>
          <div className={styles.attrValue}>
            {aroma.length > 0
              ? aroma.slice(0,3).map((n:string) => <span key={n} className={styles.chip}>{n}</span>)
              : <span className={styles.colEmpty}>—</span>}
          </div>
        </div>
        {/* ── 下段：添え物 ── */}
        <div className={styles.attrRow}>
          <div className={styles.attrLabel}>添え物</div>
          <div className={styles.attrValue}>
            {accompaniments.length > 0
              ? accompaniments.map((a:string) => <span key={a} className={styles.chipAccomp}>{a}</span>)
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
  // カード収集
  const [myName, setMyName] = useState<string>('')
  const [collected, setCollected] = useState<Set<string>>(new Set())
  const [collectState, setCollectState] = useState<
    { ok: boolean; message: string; cost: number; unavailable?: boolean } | null
  >(null)
  const [collecting, setCollecting] = useState(false)
  // 表示の切り替え（みんなの評価 / 集めたカード）
  const [tab, setTab] = useState<'all' | 'collected'>('all')
  const [collectedCards, setCollectedCards] = useState<any[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [remaking, setRemaking] = useState<string | null>(null)
  /* カード収集の仕組み(089)がまだ入っていない環境かどうか。
     true のときは、収集に関する表示をすべて隠して従来どおりの画面にする。 */
  const [collectUnavailable, setCollectUnavailable] = useState(false)

  const load = useCallback(async () => {
    /* 取得する列。allow_card_export は v320 のマイグレーション(089)で追加された列で、
       未実行の環境では存在しない。存在しない列を指定するとクエリ全体が失敗し、
       コミュニティが一件も表示されなくなるため、失敗したときは
       その列を外してもう一度取得する。（機能が使えないだけで、閲覧は続けられる） */
    const BASE_COLS = 'id, tea_name, brand_name, shop_name, tea_garden, color_hex, aroma_notes, user_id, score_aroma, score_astringency, score_richness, score_color_depth, comment, is_public, drank_at, created_at, brew_method, steep_seconds, tea_grams_per_100ml, tea_grams, water_ml, origin_country, accompaniments'

    const fetchReviews = (cols: string) => supabase
      .from('reviews')
      .select(cols)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    let { data, error } = await fetchReviews(`${BASE_COLS}, allow_card_export`)
    if (error) {
      // 列が無い環境向けの再取得。この場合は全件を「収集を許可」として扱う
      const retry = await fetchReviews(BASE_COLS)
      data = retry.data
      if (retry.error) console.error('コミュニティの取得に失敗しました', retry.error)
    }

    const reviewRows = (data ?? []) as any[]
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

      // 収集済みのカードと、カードに刷り込む自分の表示名
      const [{ data: myCards, error: cardsErr }, { data: me }] = await Promise.all([
        supabase.from('review_card_collections').select('review_id').eq('user_id', user.id),
        supabase.from('profiles').select('name').eq('id', user.id).single(),
      ])
      // テーブルが無い＝マイグレーション未実行。収集まわりの表示を一切出さない
      setCollectUnavailable(!!cardsErr)
      setCollected(new Set((myCards ?? []).map((c: any) => c.review_id)))
      setMyName(me?.name ?? '')
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

  /* 集めたカードの一覧。画像は保存しておらず、評価のデータから毎回描き直すため、
     ここで取得するのは元の評価の内容だけ。DBの容量は1件あたり数百バイトで済む。 */
  const loadCollected = useCallback(async () => {
    if (!userId) return
    setCardsLoading(true)
    const { data, error } = await supabase
      .from('my_collected_cards')
      .select('*')
      .order('collected_at', { ascending: false })
    if (!error) setCollectedCards(data ?? [])
    setCardsLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (tab === 'collected') loadCollected()
  }, [tab, loadCollected])

  /** 集めたカードの画像を作り直す（保存していないので毎回生成する・ポイントは不要） */
  async function remakeCard(c: any) {
    if (remaking) return
    setRemaking(c.review_id)
    try {
      const blob = await generateTeaCard({
        variant: 'collection',
        collected_by: myName || 'ゲスト',
        tea_name: c.tea_name,
        brand_name: c.brand_name,
        tea_garden: c.tea_garden,
        origin_country: c.origin_country,
        shop_name: c.shop_name,
        user_name: c.author_name ?? '匿名',
        drank_at: c.drank_at,
        color_hex: c.color_hex,
        comment: c.comment,
        aroma_notes: c.aroma_notes,
        brew_method: c.brew_method,
        steep_seconds: c.steep_seconds,
        tea_grams_per_100ml: c.tea_grams_per_100ml,
        tea_grams: c.tea_grams,
        water_ml: c.water_ml,
        accompaniments: c.accompaniments,
        score_aroma: c.score_aroma ?? 3,
        score_astringency: c.score_astringency ?? 3,
        score_richness: c.score_richness ?? 3,
        score_color_depth: c.score_color_depth ?? 3,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-teas-collection-${c.tea_name ?? 'card'}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e?.message ?? 'カードの作成に失敗しました')
    } finally {
      setRemaking(null)
    }
  }

  /** コレクションから外す（消費したポイントは戻らない旨を伝えてから実行する） */
  async function removeCollected(c: any) {
    if (!confirm(`「${c.tea_name}」をコレクションから外します。\n消費したポイントは戻りません。よろしいですか？`)) return
    const { error } = await supabase
      .from('review_card_collections').delete().eq('id', c.collection_id)
    if (error) { alert(error.message); return }
    setCollectedCards(prev => prev.filter(x => x.collection_id !== c.collection_id))
    setCollected(prev => { const n = new Set(prev); n.delete(c.review_id); return n })
  }

  /* 詳細を開いたときに、その評価を収集できるかをサーバーに問い合わせる。
     条件（評価件数・登録日数・1日の上限・投稿者の許可）はすべてサーバー側で
     判定しており、ここでの結果はボタンの表示を切り替えるためだけに使う。 */
  const checkCollect = useCallback(async (reviewId: string) => {
    setCollectState(null)
    if (!userId) return
    const { data, error } = await supabase.rpc('can_collect_card', { p_review_id: reviewId })
    if (error) {
      /* マイグレーション(089)が未実行だと関数そのものが無く、
         PostgREST の生のエラー文がそのまま画面に出てしまう。
         利用者には意味が分からないので、機能が未提供である旨だけを伝える。 */
      const notReady = error.code === 'PGRST202'
        || /Could not find the function/i.test(error.message ?? '')
      setCollectState({
        ok: false,
        cost: 0,
        message: notReady ? '' : error.message,
        unavailable: notReady,
      })
      return
    }
    setCollectState({
      ok: data?.ok === true,
      message: data?.message ?? '',
      cost: data?.cost ?? 0,
      unavailable: false,
    })
  }, [supabase, userId])

  useEffect(() => {
    if (selected) checkCollect(selected.id)
    else setCollectState(null)
  }, [selected, checkCollect])

  /** カードを集める（ポイント消費 → COLLECTION版のカード画像を作成） */
  async function collectCard(review: any) {
    if (!userId || collecting) return
    const already = collected.has(review.id)

    if (!already && (collectState?.cost ?? 0) > 0) {
      if (!confirm(
        `${collectState!.cost}ptを消費して、このカードを集めます。\n\n` +
        `※ カードは元の評価から毎回作り直すため、投稿者が評価を更新すると内容も変わります。\n` +
        `※ 元の評価が削除されると、一覧からも消えます。\n\n` +
        `よろしいですか？`
      )) return
    }

    setCollecting(true)
    try {
      // 収集の記録とポイント消費はサーバー側でまとめて行う
      const { data, error } = await supabase.rpc('collect_review_card', { p_review_id: review.id })
      if (error) { alert(error.message); return }
      if (data?.success !== true) { alert(data?.message ?? '集められませんでした'); return }

      setCollected(prev => new Set(prev).add(review.id))

      // Tea taster は飲んだ本人のまま。集めた人の名前は COLLECTION の右に添える。
      const blob = await generateTeaCard({
        variant: 'collection',
        collected_by: myName || 'ゲスト',
        tea_name: review.tea_name,
        brand_name: review.brand_name,
        tea_garden: review.tea_garden,
        origin_country: review.origin_country,
        shop_name: review.shop_name,
        user_name: review.profiles?.name ?? '匿名',
        drank_at: review.drank_at,
        color_hex: review.color_hex,
        comment: review.comment,
        aroma_notes: review.aroma_notes,
        brew_method: review.brew_method,
        steep_seconds: review.steep_seconds,
        tea_grams_per_100ml: review.tea_grams_per_100ml,
        tea_grams: review.tea_grams,
        water_ml: review.water_ml,
        accompaniments: review.accompaniments,
        score_aroma: review.score_aroma ?? 3,
        score_astringency: review.score_astringency ?? 3,
        score_richness: review.score_richness ?? 3,
        score_color_depth: review.score_color_depth ?? 3,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-teas-collection-${review.tea_name ?? 'card'}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await checkCollect(review.id)
    } catch (e: any) {
      alert(e?.message ?? 'カードの作成に失敗しました')
    } finally {
      setCollecting(false)
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
      {/* タイトル＋フィルターをまとめて上部に固定する */}
      <div className={styles.stickyHead}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>👥 コミュニティ</h1>
        <span className={styles.subtitle}>みんなの評価を見る</span>
      </div>

      {/* 表示の切り替え。集めたカードは「手に入れた場所」で見られるようにする */}
      {userId && (
        <div className={styles.tabRow}>
          <button
            className={`${styles.tabBtn} ${tab === 'all' ? styles.tabBtnOn : ''}`}
            onClick={() => setTab('all')}>
            みんなの評価
          </button>
          {!collectUnavailable && (
            <button
              className={`${styles.tabBtn} ${tab === 'collected' ? styles.tabBtnOn : ''}`}
              onClick={() => setTab('collected')}>
              ◆ 集めたカード{collected.size > 0 ? `（${collected.size}）` : ''}
            </button>
          )}
        </div>
      )}

      {/* フィルター（みんなの評価のときだけ） */}
      {tab === 'all' && (
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
      )}
      </div>

      {/* タイルグリッド */}
      {tab === 'all' ? (
        loading ? <p className={styles.hint}>読み込み中…</p>
        : filtered.length === 0 ? <p className={styles.hint}>{showWantsOnly ? '「飲みたい」に登録したお茶がまだありません' : 'まだ公開されている評価がありません'}</p>
        : (
          <div className={styles.tileGrid}>
            {filtered.map(r => <CommunityTile key={r.id} review={r}
              isWanted={wants.has(r.id)}
              onToggleWant={() => toggleWant(r.id)}
              canWant={!!userId}
              onClick={() => setSelected(selected?.id===r.id ? null : r)}/>)}
          </div>
        )
      ) : (
        cardsLoading ? <p className={styles.hint}>読み込み中…</p>
        : collectedCards.length === 0 ? (
          <p className={styles.hint}>
            まだカードを集めていません。「みんなの評価」から気に入った評価を開いて、
            「◆ カードを集める」を押すとここに並びます。
          </p>
        ) : (
          <>
            <div className={styles.collectedNotice}>
              <p className={styles.collectedNoticeTitle}>ご注意ください</p>
              <ul className={styles.collectedNoticeList}>
                <li>
                  カード画像は保存せず、元の評価から<strong>そのつど作り直しています</strong>。
                  何度でも無料で作成できます。
                </li>
                <li>
                  そのため、<strong>投稿した人が評価を更新すると、カードの内容も新しい内容に変わります</strong>。
                  作成した時点の内容を残しておきたい場合は、画像をダウンロードして保存してください。
                </li>
                <li>
                  <strong>元の評価が削除されると、この一覧からも消えます。</strong>
                  公開を取りやめた場合も同様です。ダウンロード済みの画像はお手元に残ります。
                </li>
              </ul>
            </div>
            <div className={styles.tileGrid}>
              {collectedCards.map(c => (
                <div key={c.collection_id} className={styles.collectedCard}>
                  <div className={styles.collectedTop}>
                    <TeaCupSvg hex={c.color_hex} size={54}/>
                    <div className={styles.collectedInfo}>
                      <p className={styles.collectedName}>{c.tea_name ?? '不明'}</p>
                      {c.brand_name && <p className={styles.hint}>🏷 {c.brand_name}</p>}
                      <p className={styles.hint}>👤 {c.author_name ?? '匿名'}</p>
                    </div>
                  </div>
                  <p className={styles.collectedMeta}>
                    集めた日: {fmtDate(c.collected_at?.slice(0,10))}
                  </p>
                  <div className={styles.collectedActions}>
                    <button className={styles.collectBtn}
                      onClick={() => remakeCard(c)}
                      disabled={remaking === c.review_id}>
                      {remaking === c.review_id ? '作成中…' : '◆ カード画像を作る'}
                    </button>
                    <button className={styles.collectedRemove}
                      onClick={() => removeCollected(c)}>
                      外す
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
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
                {formatGardenOrigin(selected.tea_garden, selected.origin_country) && <p className={styles.hint}>🌱 {formatGardenOrigin(selected.tea_garden, selected.origin_country)}</p>}
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

            {/* 飲みたい・カード収集 */}
            <div className={styles.wantRow}>
              {userId && (
                <button
                  className={`${styles.wantBtn} ${wants.has(selected.id) ? styles.wantBtnActive : ''}`}
                  onClick={() => toggleWant(selected.id)}>
                  {wants.has(selected.id) ? '🍵 飲みたい登録済み' : '🍵 飲みたい'}
                </button>
              )}
              {/* 自分の評価にはこのボタンを出さない（通常のカード作成から無料で作れるため） */}
              {userId && selected.user_id !== userId && !collectState?.unavailable && (
                <button
                  className={`${styles.collectBtn} ${collected.has(selected.id) ? styles.collectBtnOwned : ''}`}
                  onClick={() => collectCard(selected)}
                  disabled={collecting || collectState?.ok !== true}>
                  {collecting ? '作成中…'
                    : collected.has(selected.id) ? '◆ 収集済み・もう一度作る'
                    : (collectState?.cost ?? 0) > 0
                      ? `◆ カードを集める（${collectState!.cost}pt）`
                      : '◆ カードを集める'}
                </button>
              )}
            </div>
            {/* 集められない理由は、そのまま伝えたほうが親切なのでボタンの下に出す */}
            {userId && selected.user_id !== userId && collectState && !collectState.ok && collectState.message && (
              <p className={styles.collectNote}>{collectState.message}</p>
            )}

            {/* 詳細情報（入力されている項目のみ表示） */}
            {(selected.brew_method || selected.steep_seconds || selected.tea_grams != null || selected.water_ml != null || selected.tea_grams_per_100ml || selected.accompaniments?.length > 0) && (
              <div className={styles.detailInfoRow}>
                {selected.brew_method && (
                  <span className={styles.detailInfoTag}>🍵 {selected.brew_method}</span>
                )}
                {selected.steep_seconds && (
                  <span className={styles.detailInfoTag}>⏱ {selected.steep_seconds}秒</span>
                )}
                {formatLeafWater(selected.tea_grams, selected.water_ml, selected.tea_grams_per_100ml) && (
                  <span className={styles.detailInfoTag}>⚖️ {formatLeafWater(selected.tea_grams, selected.water_ml, selected.tea_grams_per_100ml)}</span>
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
