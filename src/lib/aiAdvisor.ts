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
  score_color_depth?: number | null
}

export type PreferenceStats = {
  count: number
  avg: { aroma: number; astringency: number; richness: number; colorDepth: number }
  topAroma: string | null
  topAromaCount: number
  topTea: string | null
}

export function analyzePreference(reviews: ReviewLike[]): PreferenceStats {
  const n = reviews.length
  const sum = { aroma: 0, astringency: 0, richness: 0, colorDepth: 0 }
  const aromaCount: Record<string, number> = {}
  const teaCount: Record<string, number> = {}

  for (const r of reviews) {
    sum.aroma += r.score_aroma ?? 3
    sum.astringency += r.score_astringency ?? 3
    sum.richness += r.score_richness ?? 3
    sum.colorDepth += r.score_color_depth ?? 3
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
      colorDepth: n ? sum.colorDepth / n : 3,
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
  high: { astringency: 'しっかりした渋み', richness: '濃厚なコク', colorDepth: '濃い水色', aroma: '華やかな香り' },
  low:  { astringency: 'まろやかな口当たり', richness: 'すっきりした味わい', colorDepth: '澄んだ淡い水色', aroma: '繊細な香り' },
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

  ;(['richness', 'astringency', 'colorDepth'] as const).forEach(key => {
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

// ─── 診断アンケート（好みプロファイル） ───
// 紅茶のフローチャート診断を参考に、APIへ渡す前にユーザーの好みを詳細化する。
// 「こだわらない」= 未指定として扱う。
export type TastePreferences = {
  style: 'ストレート' | 'ミルクティー' | 'アイスティー' | ''   // 飲み方
  mood: 'すっきり爽快' | 'リラックス・コク深め' | ''            // 今の気分
  sweetAroma: '好き' | '苦手' | ''                              // 甘い香り
  aromaLikes: string[]                                          // 好きな香りの系統（複数）
  astringency: 'キリッとしっかり' | '控えめ・まろやか' | ''      // 渋みの好み
  body: '濃厚' | '軽やか' | ''                                   // コク・味の濃さ
  freeText: string                                               // その他の希望（任意）
}

export const AROMA_LIKE_OPTIONS = [
  'はちみつ・甘い花',
  'レモン・柑橘',
  'りんご・フルーティー',
  '若草・グリーン',
  'ビスケット・香ばしい',
  'スイートポテト・甘い根菜',
  'ミント・ハーブ',
  '燻製・スモーキー',
]

export function emptyPreferences(): TastePreferences {
  return { style: '', mood: '', sweetAroma: '', aromaLikes: [], astringency: '', body: '', freeText: '' }
}

// 本番API接続時にそのまま使える形で、診断内容+過去の評価傾向を1つのプロンプト文に組み立てる。
// モック実装の間も、この関数の出力が「APIへ渡す予定の内容」のプレビューとして機能する。
export function buildRecommendationPrompt(reviews: ReviewLike[], prefs: TastePreferences): string {
  const stats = analyzePreference(reviews)
  const lines: string[] = []

  lines.push('あなたは紅茶のソムリエです。以下のユーザーの好みと評価履歴をもとに、次に飲むべき紅茶を1つ提案し、その理由を説明してください。')
  lines.push('')
  lines.push('【今回の希望】')
  if (prefs.style) lines.push(`・飲み方: ${prefs.style}`)
  if (prefs.mood) lines.push(`・気分: ${prefs.mood}`)
  if (prefs.sweetAroma) lines.push(`・甘い香り: ${prefs.sweetAroma}`)
  if (prefs.aromaLikes.length) lines.push(`・好きな香りの系統: ${prefs.aromaLikes.join('、')}`)
  if (prefs.astringency) lines.push(`・渋みの好み: ${prefs.astringency}`)
  if (prefs.body) lines.push(`・コク、味の濃さ: ${prefs.body}`)
  if (prefs.freeText.trim()) lines.push(`・その他の希望: ${prefs.freeText.trim()}`)
  if (lines[lines.length - 1] === '【今回の希望】') lines.push('・特に指定なし')

  lines.push('')
  lines.push('【過去の評価傾向】')
  if (reviews.length === 0) {
    lines.push('・まだ評価データなし')
  } else {
    lines.push(`・評価件数: ${reviews.length}件`)
    lines.push(`・平均スコア: 香り${stats.avg.aroma.toFixed(1)} / 渋み${stats.avg.astringency.toFixed(1)} / コク${stats.avg.richness.toFixed(1)} / 水色${stats.avg.colorDepth.toFixed(1)}（5段階）`)
    if (stats.topAroma) lines.push(`・よく選ぶ香りノート: ${stats.topAroma}（${stats.topAromaCount}件）`)
    if (stats.topTea) lines.push(`・よく飲む茶葉: ${stats.topTea}`)
  }
  return lines.join('\n')
}

// MOCK実装：好みの傾向から「次に飲むべき一杯」を提案する
// （本番ではbuildRecommendationPromptの出力を外部AI APIに渡し、レスポンスに置き換える想定）
export function generateRecommendation(reviews: ReviewLike[], prefs?: TastePreferences): TeaRecommendation {
  const p = prefs ?? emptyPreferences()

  // 診断回答があればフローチャートに沿って優先的に判定する（モック簡易ロジック）
  if (p.style === 'ミルクティー') {
    if (p.sweetAroma === '好き') {
      return {
        title: p.aromaLikes.includes('スイートポテト・甘い根菜')
          ? 'アッサム（甘い芋のような香りのミルクティー向き茶葉）'
          : 'ケニアCTCやアッサムなど、甘みとコクのミルクティー向き茶葉',
        reason: 'ミルクティー派で甘い香りがお好きとのことなので、濃厚なコクと自然な甘みを持つ茶葉がよく合います。しっかり濃いめに淹れてミルクをたっぷり注ぐのがおすすめです。',
      }
    }
    return {
      title: p.aromaLikes.includes('ミント・ハーブ')
        ? 'ウバ（メントール様の爽快な香りのミルクティー）'
        : 'ウバやディンブラなど、キレのあるミルクティー向き茶葉',
      reason: 'ミルクティー派で甘い香りは控えめがお好みとのこと。渋みとキレのある茶葉なら、ミルクと合わせても味がぼやけず、すっきりした後味が楽しめます。',
    }
  }
  if (p.style === 'ストレート' || p.mood === 'すっきり爽快') {
    if (p.aromaLikes.includes('レモン・柑橘')) {
      return { title: 'ヌワラエリヤ（柑橘のような爽やかな高地産セイロン）', reason: 'ストレートで柑橘系の香りがお好みなら、「セイロンティーのシャンパン」と呼ばれる爽快な香りのヌワラエリヤがぴったりです。' }
    }
    if (p.aromaLikes.includes('燻製・スモーキー')) {
      return { title: 'キーマン（スモーキーな香りの中国紅茶）', reason: '燻製系の香りがお好きなら、独特のスモーキーさとほのかな甘みを持つキーマンをストレートでどうぞ。' }
    }
    if (p.aromaLikes.includes('はちみつ・甘い花')) {
      return { title: 'ダージリン セカンドフラッシュ', reason: 'はちみつや花のような香りがお好みなら、マスカテルフレーバーで名高いダージリンの夏摘みが最有力です。' }
    }
    if (p.aromaLikes.includes('若草・グリーン')) {
      return { title: 'ニルギリまたはダージリン ファーストフラッシュ', reason: '若草のような瑞々しい香りがお好きなら、春摘みの爽やかなタイプがおすすめです。' }
    }
  }
  if (p.mood === 'リラックス・コク深め' || p.body === '濃厚') {
    if (p.astringency === '控えめ・まろやか') {
      return { title: 'キャンディやルフナなど、渋み控えめでコクのあるセイロン', reason: 'コクがありつつ渋みは穏やかなタイプをお探しなら、低地産セイロンのまろやかな甘みがよく合います。' }
    }
    return { title: 'アッサムやウバなど、コクと深みのある茶葉', reason: 'リラックスしたい気分の時は、深いコクのある茶葉をゆっくり楽しむのがおすすめです。' }
  }

  // 診断未回答の場合は従来通り、過去の評価傾向から判定
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
  if (stats.avg.colorDepth <= 2.2 && stats.avg.astringency <= 2.5) {
    return { title: 'ダージリンやニルギリなど、水色が淡く繊細な軽やかな茶葉', reason: `渋みが控えめで、水色も淡いすっきりとした茶葉の評価が高めです。ストレートでゆっくり楽しむのがおすすめです。` }
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

