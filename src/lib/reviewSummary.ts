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
// ・review.notes（「その他の情報」欄・自由記述300文字）は、要約の重要な判断材料。
//   API接続時も必ずプロンプトに含めること（例: 産地・グレード・購入場所などの
//   情報が入る想定で、味の傾向やおすすめ文の根拠として使う）。
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
  score_color_depth?: number | null
  notes?: string | null
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
  const colorDepth = level(review.score_color_depth, '濃いめの水色', 'ほどよい水色の濃さ', '澄んだ淡い水色')
  const aromaNoteText = (review.aroma_notes ?? []).slice(0, 2).join('・')
  const freeNotes = review.notes?.trim() || ''

  if (tone === 'ojou') {
    let s = `まあ、${name}ですって！ ${aroma}がふわりと立ちのぼり、${astr}がなんとも上品ですこと。`
    s += `${rich}を感じる、${colorDepth}の一杯で、それはそれは優雅ですわ。`
    if (aromaNoteText) s += ` ${aromaNoteText}の風情も、たいそう心を躍らせてくれますのよ。`
    if (freeNotes) s += ` ${freeNotes}とのことで、そのあたりも味わいの奥行きを教えてくれますわね。`
    return s
  }

  // normal
  let s = `${name}は${aroma}が印象的な一杯。${astr}と${rich}のバランスがよく、${colorDepth}が楽しめます。`
  if (aromaNoteText) s += ` ${aromaNoteText}のニュアンスも感じられ、落ち着いて味わいたい紅茶です。`
  if (freeNotes) s += ` ${freeNotes}という点も、この紅茶を選ぶ参考になりそうです。`
  return s
}
