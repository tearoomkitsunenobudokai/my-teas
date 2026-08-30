// ─────────────────────────────────────────────────────────
// 評価のAI要約（プロトタイプ版）
//
// 現状は外部AI APIを呼ばず、ローカルのルールベースで「それっぽい」要約を
// 生成しています（追加料金なしで動作確認するため）。
//
// 将来 Anthropic API などに接続する際は、summarizeReview() の中身を
//   const res = await fetch('/api/summarize', {
//     method: 'POST',
//     body: JSON.stringify({ review, style }),
//   })
//   const { text } = await res.json()
//   return text
// のように差し替えるだけで、呼び出し側（reviews/page.tsx）は変更不要です。
//
// ・APIキーは必ずサーバー側（Route Handler / Edge Function）に置くこと。
// ・buildStyleInstruction() が、選ばれた文体・長さを日本語の指示文に変換します。
//   API接続時は、この文字列をそのままシステムプロンプトに差し込んでください。
//   ルールベースと実APIで指示がぶれないよう、指示文の出典はここ1か所に保つこと。
// ・review.notes（「その他の情報」欄・自由記述300文字）は、要約の重要な判断材料。
//   API接続時も必ずプロンプトに含めること（例: 産地・グレード・購入場所などの
//   情報が入る想定で、味の傾向やおすすめ文の根拠として使う）。
// ─────────────────────────────────────────────────────────

/** 語尾・文体 */
export type SummaryTone = 'desumasu' | 'dearu' | 'ojou'
/** 長さ。'short' は v387 で廃止したが、既存データを読めるよう型には残す。 */
export type SummaryLength = 'short' | 'normal' | 'long'

export type SummaryStyle = {
  tone: SummaryTone
  length: SummaryLength
}

export const DEFAULT_STYLE: SummaryStyle = { tone: 'desumasu', length: 'normal' }

export const TONE_OPTIONS: { value: SummaryTone; label: string; sample: string }[] = [
  { value: 'desumasu', label: 'ですます調', sample: '〜です／〜ます' },
  { value: 'dearu',    label: 'である調',   sample: '〜だ／〜である' },
  { value: 'ojou',     label: 'お嬢様風',   sample: '〜ですわ／〜ですのよ' },
]

export const LENGTH_OPTIONS: { value: SummaryLength; label: string; note: string; max: number }[] = [
  { value: 'normal', label: '標準', note: '120字・Xにそのまま載る長さ', max: 120 },
  { value: 'long',   label: '長め', note: '200字以内・カード向け',      max: 200 },
]

/** 廃止した長さが保存されている場合に備え、必ず既定値へ寄せる */
function lengthSpec(length: SummaryLength) {
  return LENGTH_OPTIONS.find(o => o.value === length) ?? LENGTH_OPTIONS[0]
}

/** 選択内容を短い表記にする（保存済み要約の見出しに使う） */
export function styleLabel(style: SummaryStyle): string {
  const t = TONE_OPTIONS.find(o => o.value === style.tone)?.label ?? ''
  const l = (LENGTH_OPTIONS.find(o => o.value === style.length) ?? LENGTH_OPTIONS[0]).label
  return `${t}・${l}`
}

/**
 * 選択された文体・長さを、AIへの指示文に変換する。
 * API接続時は、この文字列をシステムプロンプトに埋め込むこと。
 */
export function buildStyleInstruction(style: SummaryStyle): string {
  const tone = {
    desumasu: '文末は「です・ます」で統一した、ていねいな敬体で書くこと。',
    dearu:    '文末は「だ・である」で統一した常体で書くこと。敬語は使わないこと。',
    ojou:     'いわゆる「お嬢様言葉」で書くこと。文末は「〜ですわ」「〜ですのよ」「〜ますこと」などを使い、上品で優雅な言い回しにすること。ただし読みにくくなるほど大げさにはしないこと。',
  }[style.tone]

  const len = lengthSpec(style.length)
  const length = len.value === 'long'
    ? `全体で200字程度、最大でも${len.max}字に収めること。3〜4文で、味わいの移り変わりや飲み方の提案まで含めてよい。`
    : `全体で120字程度、最大でも${len.max}字に収めること。2〜3文でまとめること。Xにそのまま投稿できる長さにすること。`

  return [
    '以下のルールを必ず守って、紅茶の感想文を書いてください。',
    `- ${tone}`,
    `- ${length}`,
    '- 与えられた情報だけを使い、書かれていない産地・価格・品種などを推測して書かないこと。',
    '- 箇条書きにせず、地の文で書くこと。',
    '- 見出しや「まとめ：」のような前置きを付けないこと。',
  ].join('\n')
}

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

/** 文を順に足していき、指定の文字数を超えたらそこで打ち切る */
function joinWithin(sentences: string[], max: number): string {
  let out = ''
  for (const s of sentences) {
    if (out && out.length + s.length > max) break
    out += s
  }
  // 1文目だけで上限を超える場合は、不自然に切らずそのまま返す
  return out || sentences[0] || ''
}

// モック要約を生成する（将来 fetch に差し替え予定）
export async function summarizeReview(
  review: ReviewForSummary,
  style: SummaryStyle = DEFAULT_STYLE,
): Promise<string> {
  // 実APIを模した軽い遅延（体感を近づける）
  await new Promise(res => setTimeout(res, 600))

  const name = review.tea_name?.trim() || 'この紅茶'
  const aroma = level(review.score_aroma, '華やかな香り', '穏やかな香り', '控えめな香り')
  const astr = level(review.score_astringency, 'しっかりとした渋み', 'ほどよい渋み', 'やわらかな口当たり')
  const rich = level(review.score_richness, '深いコク', '程よいコク', '軽やかな味わい')
  const colorDepth = level(review.score_color_depth, '濃いめの水色', 'ほどよい水色の濃さ', '澄んだ淡い水色')
  const aromaNoteText = (review.aroma_notes ?? []).slice(0, 2).join('・')
  const freeNotes = review.notes?.trim() || ''

  // 文体ごとに、同じ内容を別の言い回しで用意する。
  // 前から順に採用し、長さの上限に達したところで打ち切る。
  const sentences: string[] = {
    desumasu: [
      `${name}は${aroma}が印象的な一杯です。`,
      `${astr}と${rich}のバランスがよく、${colorDepth}が楽しめます。`,
      aromaNoteText ? `${aromaNoteText}のニュアンスも感じられ、落ち着いて味わいたい紅茶です。` : '',
      freeNotes ? `${freeNotes}という点も、この紅茶を選ぶ参考になりそうです。` : '',
    ],
    dearu: [
      `${name}は${aroma}が印象的な一杯だ。`,
      `${astr}と${rich}のバランスがよく、${colorDepth}を楽しめる。`,
      aromaNoteText ? `${aromaNoteText}のニュアンスも感じられ、落ち着いて味わいたい紅茶である。` : '',
      freeNotes ? `${freeNotes}という点も、この紅茶を選ぶ際の参考になるだろう。` : '',
    ],
    ojou: [
      `まあ、${name}ですって！ ${aroma}がふわりと立ちのぼりますわ。`,
      `${astr}がなんとも上品で、${rich}を感じる${colorDepth}の一杯ですのよ。`,
      aromaNoteText ? `${aromaNoteText}の風情も、たいそう心を躍らせてくれますこと。` : '',
      freeNotes ? `${freeNotes}とのことで、そのあたりも味わいの奥行きを教えてくれますわね。` : '',
    ],
  }[style.tone].filter(Boolean)

  const max = lengthSpec(style.length).max
  return joinWithin(sentences, max)
}
