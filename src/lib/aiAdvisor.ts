// ─────────────────────────────────────────────────────────
// AI分析（プロトタイプ版）
//
// 現状は外部AI APIを呼び出さず、ローカルのルールベースロジックで
// 「それっぽい」分析コメントを生成しています（追加料金なしで動作確認するため）。
//
// 将来的に外部AI API（例: Anthropic API）と連携する際は、
// generateAdvisorComment() / generateFortune() の中身を
// fetch('/api/ai-advisor', ...) のようなAPI呼び出しに差し替えるだけで
// 呼び出し側（advisor/page.tsx, fortune/page.tsx）の変更は不要な設計にしています。
// ─────────────────────────────────────────────────────────

import { OMIKUJI_DATA, OmikujiEntry } from './omikujiData'

export type ReviewLike = {
  tea_name?: string | null
  shop_name?: string | null
  aroma_notes?: string[] | null
  score_aroma?: number | null
  score_astringency?: number | null
  score_richness?: number | null
  score_sweetness?: number | null
}

export type PreferenceStats = {
  count: number
  avg: { aroma: number; astringency: number; richness: number; sweetness: number }
  topAroma: string | null
  topAromaCount: number
  topTea: string | null
}

export function analyzePreference(reviews: ReviewLike[]): PreferenceStats {
  const n = reviews.length
  const sum = { aroma: 0, astringency: 0, richness: 0, sweetness: 0 }
  const aromaCount: Record<string, number> = {}
  const teaCount: Record<string, number> = {}

  for (const r of reviews) {
    sum.aroma += r.score_aroma ?? 3
    sum.astringency += r.score_astringency ?? 3
    sum.richness += r.score_richness ?? 3
    sum.sweetness += r.score_sweetness ?? 3
    for (const a of r.aroma_notes ?? []) aromaCount[a] = (aromaCount[a] ?? 0) + 1
    if (r.tea_name) teaCount[r.tea_name] = (teaCount[r.tea_name] ?? 0) + 1
  }

  const topAromaEntry = Object.entries(aromaCount).sort((a, b) => b[1] - a[1])[0]
  const topTeaEntry = Object.entries(teaCount).sort((a, b) => b[1] - a[1])[0]

  return {
    count: n,
    avg: {
      aroma: n ? sum.aroma / n : 3,
      astringency: n ? sum.astringency / n : 3,
      richness: n ? sum.richness / n : 3,
      sweetness: n ? sum.sweetness / n : 3,
    },
    topAroma: topAromaEntry?.[0] ?? null,
    topAromaCount: topAromaEntry?.[1] ?? 0,
    topTea: topTeaEntry?.[0] ?? null,
  }
}

export type AdvisorTierKey = 'novice' | 'mid' | 'veteran'

export type AdvisorTier = {
  key: AdvisorTierKey
  name: string
  emoji: string
  levelLabel: string
  minCount: number
  rangeLabel: string
}

// 評価件数に応じてキャラクターが解放される（下位キャラは解放後いつでも選択可能）
export const ADVISOR_TIERS: AdvisorTier[] = [
  { key: 'novice',  name: '見習いAIティーアドバイザー', emoji: '🐤', levelLabel: 'ひよっこ', minCount: 1,  rangeLabel: '1〜2件で解放' },
  { key: 'mid',     name: '中堅AIティーアドバイザー',   emoji: '🐭', levelLabel: 'ねずみ',   minCount: 3,  rangeLabel: '3〜9件で解放' },
  { key: 'veteran', name: 'ベテランAIティーアドバイザー', emoji: '🦎', levelLabel: 'リザ',     minCount: 10, rangeLabel: '10件〜で解放' },
]

export function getTierByKey(key: AdvisorTierKey): AdvisorTier {
  return ADVISOR_TIERS.find(t => t.key === key) ?? ADVISOR_TIERS[0]
}

export function isTierUnlocked(tier: AdvisorTier, reviewCount: number): boolean {
  return reviewCount >= tier.minCount
}

// 評価から到達可能な最上位キャラクターを返す（自動振り分け用・初期選択に使用）
export function getAdvisorTier(reviewCount: number): AdvisorTier {
  const unlocked = ADVISOR_TIERS.filter(t => isTierUnlocked(t, reviewCount))
  return unlocked[unlocked.length - 1] ?? ADVISOR_TIERS[0]
}

// ─── 分析履歴（直近1週間） ───
// キャラクターごとに表示が上書きされないよう、1回の「聞く」操作ごとに
// 「その時選ばれていたキャラクター」と「その時のコメント」をセットで1件として保存する。
export type AdvisorHistoryEntry = {
  id: string
  tierKey: AdvisorTierKey
  comment: string
  createdAt: string // ISO文字列
}

const HISTORY_DAYS = 7

export function pruneHistory(entries: AdvisorHistoryEntry[]): AdvisorHistoryEntry[] {
  const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000
  return entries.filter(e => {
    const t = new Date(e.createdAt).getTime()
    return !Number.isNaN(t) && t >= cutoff
  })
}

const SCORE_TAGS = {
  high: { astringency: 'しっかりした渋み', richness: '濃厚なコク', sweetness: 'はっきりした甘み', aroma: '華やかな香り' },
  low:  { astringency: 'まろやかな口当たり', richness: 'すっきりした味わい', sweetness: '控えめな甘さ', aroma: '繊細な香り' },
}

// X（旧Twitter）にそのまま投稿できることを想定した文字数上限
// 日本語（全角）はXの表示上、実質140文字程度が目安なので140に設定
export const MAX_X_LENGTH = 140

// MOCK実装：ルールベースでそれっぽいコメントを生成する
// （本番ではここを外部AI APIのレスポンスに置き換える想定）
// tierKey を渡すと、自動振り分け以外の「下位キャラクター」を指定して喋らせることができる
//
// 文字数制限の対応方針：
// 後から slice() で切り詰めると文の途中で千切れて意味不明になるため、
// 「必須の文」→「あれば足したい補足の文」の順に“文単位”で積み上げ、
// MAX_X_LENGTH を超える文は最初から足さない（途中で切らない）ようにしている。
export function generateAdvisorComment(reviews: ReviewLike[], tierKey?: AdvisorTierKey): string {
  if (reviews.length === 0) {
    return 'まだ評価が登録されていません。お茶を飲んだら評価を登録してみてください。データが増えるほど分析の精度が上がります。'
  }

  const stats = analyzePreference(reviews)
  const traits: string[] = []

  ;(['richness', 'astringency', 'sweetness'] as const).forEach(key => {
    const v = stats.avg[key]
    if (v >= 3.8) traits.push(SCORE_TAGS.high[key])
    else if (v <= 2.2) traits.push(SCORE_TAGS.low[key])
  })

  const tier = tierKey ? getTierByKey(tierKey) : getAdvisorTier(reviews.length)
  const confidencePrefix =
    tier.key === 'novice' ? 'まだ評価が少なめなので参考程度ですが、' :
    tier.key === 'mid'    ? 'これまでの傾向を見るに、' :
                             '十分なデータが集まってきたので自信を持って言いますが、'

  const traitPart = traits.length
    ? `${traits.slice(0, 2).join('、')}のお茶を選ぶことが多いようです。`
    : '幅広いタイプのお茶をバランスよく楽しんでいるようです。'

  // 必須の1文（要約・結論）。これだけは必ず含める
  const required = `${confidencePrefix}これまでの${stats.count}件の評価から、あなたは${traitPart}`

  // あれば足したい補足の文（文字数に余裕があるときだけ後ろに追加していく）
  const optionalSentences: string[] = []
  if (stats.topAroma) {
    optionalSentences.push(`特に「${stats.topAroma}」系の香りを好む傾向（${stats.topAromaCount}件）があります。`)
  }
  if (stats.topTea && stats.count >= 3) {
    optionalSentences.push(`中でも「${stats.topTea}」を繰り返し飲んでいるのが印象的です。`)
  }
  const closing = '次は似た系統の新しい茶葉を試してみるのもおすすめです。'

  let comment = required
  // 補足文は「足しても上限内に収まる」場合だけ追加する（途中で切らない）
  for (const s of optionalSentences) {
    if ((comment + s + closing).length <= MAX_X_LENGTH) comment += s
  }
  // 締めの一文も収まる場合だけ追加する
  if ((comment + closing).length <= MAX_X_LENGTH) comment += closing

  return comment
}

// ─── おすすめの1杯（評価データに基づく提案・占いとは異なりロジックベース） ───
export type TeaRecommendation = {
  title: string       // おすすめの一杯（お茶の系統・淹れ方の提案）
  reason: string       // 提案理由
}

// MOCK実装：好みの傾向から「次に飲むべき一杯」を提案する
// （本番ではここを外部AI APIのレスポンスに置き換える想定）
export function generateRecommendation(reviews: ReviewLike[]): TeaRecommendation {
  if (reviews.length === 0) {
    return {
      title: 'まずは気になる一杯から',
      reason: 'まだ評価データがないため、直近で気になっているお茶を試して評価を登録してみてください。データが増えるほど提案の精度が上がります。',
    }
  }

  const stats = analyzePreference(reviews)

  // スコア傾向から系統を軽く判定（モック実装）
  if (stats.avg.richness >= 3.8 && stats.avg.astringency >= 3.5) {
    return { title: 'アッサムやウバなど、コクと渋みの強い茶葉', reason: `これまでの評価でコク・渋みともに高めの茶葉を好む傾向があります。ミルクティーとの相性も良いタイプです。` }
  }
  if (stats.avg.sweetness >= 3.8 && stats.avg.astringency <= 2.5) {
    return { title: 'ダージリンやニルギリなど、甘みを感じやすい軽やかな茶葉', reason: `渋みは控えめで甘みを感じる茶葉の評価が高めです。ストレートでゆっくり楽しむのがおすすめです。` }
  }
  if (stats.topAroma) {
    return { title: `「${stats.topAroma}」系の香りが強い茶葉`, reason: `過去の評価で「${stats.topAroma}」系の香りを選ぶことが多いようです（${stats.topAromaCount}件）。同じ香りの系統で新しい茶葉を探してみるのはいかがでしょうか。` }
  }
  if (stats.topTea) {
    return { title: `「${stats.topTea}」に近いタイプの茶葉`, reason: `よく飲んでいる「${stats.topTea}」の系統に近い茶葉であれば、好みに合う可能性が高いです。` }
  }
  return { title: 'ニルギリなど、クセの少ないバランス型の茶葉', reason: '幅広いタイプを評価されているため、まずはクセの少ないバランス型から試すのがおすすめです。' }
}

// 全100種の中からランダムに1つを引く（本番でも同じ：おみくじは常にランダム抽選）
export function generateFortune(): OmikujiEntry {
  const idx = Math.floor(Math.random() * OMIKUJI_DATA.length)
  return OMIKUJI_DATA[idx]
}

// ─── コレクション（これまでに引いた全ての番号。上限なく蓄積） ───
export function addToCollection(collected: number[], no: number): number[] {
  if (collected.includes(no)) return collected
  return [...collected, no].sort((a, b) => a - b)
}

