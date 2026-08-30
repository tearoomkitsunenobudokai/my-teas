// ─────────────────────────────────────────────────────────
// 評価をXにポストするための文面を組み立てる。
//
// Xの上限は「重み付き280」で、日本語などの全角文字は1文字あたり2として
// 数えられる。URLは実際の長さにかかわらず一律23として扱われる。
// ここではその数え方を再現し、上限に収まるよう本文を削る。
// ─────────────────────────────────────────────────────────

/** ポストに必ず付けるタグ */
export const POST_HASHTAGS = '#My-Teas #紅茶'

/** Xの上限（重み付き） */
const WEIGHT_LIMIT = 280
/** URLは実際の長さによらず、この重みとして数えられる */
const URL_WEIGHT = 23

/**
 * Xの数え方で重みを求める。
 * 半角英数・記号は1、それ以外（日本語など）は2として数える。
 */
export function postWeight(text: string): number {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    // 概ね ASCII と一部の記号が1、それ以外が2
    w += (c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2
  }
  return w
}

/** 指定の重みに収まるところまで本文を切り、切った場合は末尾に「…」を付ける */
function trimToWeight(text: string, limit: number): string {
  if (postWeight(text) <= limit) return text
  let out = ''
  // 「…」の分（重み2）を空けておく
  const room = limit - 2
  for (const ch of text) {
    if (postWeight(out + ch) > room) break
    out += ch
  }
  return out.trimEnd() + '…'
}

export type ReviewForPost = {
  tea_name?: string | null
  brand_name?: string | null
  shop_name?: string | null
  comment?: string | null
  summary_text?: string | null
  summary_normal?: string | null
  aroma_notes?: string[] | null
}

/**
 * ポストのたたき台を作る。
 * 本文は AI要約 → 自分のメモ → 香りノートからの自動文、の順で使う。
 * 利用者はX側の画面で自由に書き換えられるため、ここではあくまで下書きを渡す。
 */
export function buildPostText(review: ReviewForPost, siteUrl?: string): string {
  const name = review.tea_name?.trim() || 'この紅茶'
  const brand = review.brand_name?.trim() || ''
  const shop = review.shop_name?.trim() || ''

  // 1行目：何を飲んだか
  const head = brand ? `${brand}の${name}` : name
  const where = shop ? `＠${shop}` : ''
  const line1 = `${head}を飲みました。${where}`

  // 本文：要約があればそれを使う
  const body = (
    review.summary_text?.trim() ||
    review.summary_normal?.trim() ||
    review.comment?.trim() ||
    ((review.aroma_notes ?? []).length > 0
      ? `${(review.aroma_notes as string[]).slice(0, 3).join('・')}の香りが印象的でした。`
      : '')
  )

  // 本文に使える重みを求める（1行目・タグ・URL・改行を差し引く）
  const fixed = [line1, POST_HASHTAGS].join('\n')
  let room = WEIGHT_LIMIT - postWeight(fixed) - 2 // 本文前後の改行
  if (siteUrl) room -= URL_WEIGHT + 1

  const parts = [line1]
  if (body && room > 10) parts.push(trimToWeight(body, room))
  parts.push(POST_HASHTAGS)
  if (siteUrl) parts.push(siteUrl)

  return parts.join('\n')
}

/** Xの投稿画面を開くURLを作る */
export function buildPostUrl(review: ReviewForPost, siteUrl?: string): string {
  const text = buildPostText(review, siteUrl)
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}
