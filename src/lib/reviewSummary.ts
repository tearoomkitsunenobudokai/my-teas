// ─────────────────────────────────────────────────────────
// 評価のAI要約（プロトタイプ版）
//
// 現状は外部AI APIを呼ばず、ローカルのルールベースで「それっぽい」要約を
// 生成しています（追加料金なしで動作確認するため）。
//
// 将来 Anthropic API などに接続する際は、summarizeReview() の中身を
//   const res = await fetch('/api/summarize', {
//     method: 'POST',
//     body: JSON.stringify({ review, tone }),
//   })
//   const { text } = await res.json()
//   return text
// のように差し替えるだけで、呼び出し側（reviews/page.tsx）は変更不要です。
//
// ・APIキーは必ずサーバー側（Route Handler / Edge Function）に置くこと。
// ・tone は 'normal'（通常）と 'ojou'（お嬢様言葉）の2種類。
//   API接続時は、tone に応じてシステムプロンプトを切り替える想定です。
// ─────────────────────────────────────────────────────────

export type SummaryTone = 'normal' | 'ojou'

export type ReviewForSummary = {
  tea_name?: string | null
  brand_name?: string | null
  shop_name?: string | null
  comment?: string | null
  score_aroma?: number | null
  score_astringency?: number | null
  score_richness?: number | null
  score_sweetness?: number | null
  aroma_notes?: string[] | null
}

// スコアを言葉に変換するヘルパー
function level(v: number | null | undefined, high: string, mid: string, low: string): string {
  const n = v ?? 3
  if (n >= 4) return high
  if (n <= 2) return low
  return mid
}

// モック要約を生成する（将来 fetch に差し替え予定）
export async function summarizeReview(review: ReviewForSummary, tone: SummaryTone): Promise<string> {
  // 実APIを模した軽い遅延（体感を近づける）
  await new Promise(res => setTimeout(res, 600))

  const name = review.tea_name?.trim() || 'この紅茶'
  const aroma = level(review.score_aroma, '華やかな香り', '穏やかな香り', '控えめな香り')
  const astr = level(review.score_astringency, 'しっかりとした渋み', 'ほどよい渋み', 'やわらかな口当たり')
  const rich = level(review.score_richness, '深いコク', '程よいコク', '軽やかな味わい')
  const sweet = level(review.score_sweetness, 'やさしい甘み', 'さっぱりとした後味', 'すっきりとした後味')
  const notes = (review.aroma_notes ?? []).slice(0, 2).join('・')

  if (tone === 'ojou') {
    let s = `まあ、${name}ですって！ ${aroma}がふわりと立ちのぼり、${astr}がなんとも上品ですこと。`
    s += `${rich}に${sweet}が寄り添って、それはそれは優雅な一杯ですわ。`
    if (notes) s += ` ${notes}の風情も、たいそう心を躍らせてくれますのよ。`
    return s
  }

  // normal
  let s = `${name}は${aroma}が印象的な一杯。${astr}と${rich}のバランスがよく、${sweet}が楽しめます。`
  if (notes) s += ` ${notes}のニュアンスも感じられ、落ち着いて味わいたい紅茶です。`
  return s
}
