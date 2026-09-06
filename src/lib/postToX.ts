// ─────────────────────────────────────────────────────────
// 評価をXにポストするための文面を組み立てる。
//
// Xの上限は「重み付き280」で、日本語などの全角文字は1文字あたり2として
// 数えられる。URLは実際の長さにかかわらず一律23として扱われる。
// ここではその数え方を再現し、上限に収まるよう本文を削る。
// ─────────────────────────────────────────────────────────

/** ポストに必ず付けるタグ */
export const POST_HASHTAGS = '#紅茶 #My-Teas'
/** ポストに必ず付けるアカウント */
export const POST_MENTION = '@myteas_kbk'

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
 *
 * 並びは「本文 → 紅茶の情報 → タグ → アカウント」で固定。
 * hashtags パラメータを使うとタグが必ず末尾に付き、
 * アカウントがタグより前に来てしまうため、すべて text にまとめている。
 *
 * 紅茶名・ブランド・お店は、入力されているものだけを並べる。
 * 未入力の項目は行ごと出さない（「ブランド未設定」などと出さない）。
 *
 * 利用者はX側の画面で自由に書き換えられるため、ここではあくまで下書きを渡す。
 */
export function buildPostText(review?: ReviewForPost): string {
  const tea   = review?.tea_name?.trim() || ''
  const brand = review?.brand_name?.trim() || ''
  const shop  = review?.shop_name?.trim() || ''

  const head = tea ? `${tea}を飲みました！` : 'お茶を飲みました！'

  // 紅茶の情報。入力があるものだけを行にする。
  const info: string[] = []
  if (brand) info.push(`🏷️ ${brand}`)
  if (shop)  info.push(`🏠 ${shop}`)

  const lines = [head, ...info, POST_HASHTAGS, POST_MENTION]
  const text = lines.join('\n')

  // 上限を超える場合は、紅茶の情報から削って収める。
  // タグとアカウントは必ず残す。
  if (postWeight(text) <= WEIGHT_LIMIT) return text
  while (info.length > 0) {
    info.pop()
    const t = [head, ...info, POST_HASHTAGS, POST_MENTION].join('\n')
    if (postWeight(t) <= WEIGHT_LIMIT) return t
  }
  // それでも収まらない場合は、見出しを切り詰める
  const fixed = [POST_HASHTAGS, POST_MENTION].join('\n')
  const room = WEIGHT_LIMIT - postWeight(fixed) - 1
  return [trimToWeight(head, room), POST_HASHTAGS, POST_MENTION].join('\n')
}

/** Xの投稿画面を開くURLを作る（ブラウザ版） */
export function buildPostUrl(review?: ReviewForPost): string {
  const text = buildPostText(review)
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}

/**
 * Xの投稿画面を開く。
 *
 * スマホでは、まずXアプリを開こうとする。
 * ブラウザ版（x.com/intent/post）だと、アプリにログインしていても
 * ブラウザ側にセッションが無ければログイン画面が出てしまうため。
 *
 * アプリが入っていない場合に備え、一定時間たっても画面が切り替わらなければ
 * ブラウザ版を開く。アプリが開いた場合はページが背面に回るので、
 * visibilitychange / pagehide を見て取り消す。
 */
export function openPostToX(review?: ReviewForPost): void {
  const text = buildPostText(review)
  const webUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)

  if (!isMobile) {
    window.open(webUrl, '_blank', 'noopener,noreferrer')
    return
  }

  // Xアプリのスキーム。X になった今も twitter:// が使われている。
  const appUrl = `twitter://post?message=${encodeURIComponent(text)}`

  let cancelled = false
  const cancel = () => { cancelled = true }
  document.addEventListener('visibilitychange', cancel, { once: true })
  window.addEventListener('pagehide', cancel, { once: true })
  window.addEventListener('blur', cancel, { once: true })

  const timer = setTimeout(() => {
    document.removeEventListener('visibilitychange', cancel)
    window.removeEventListener('pagehide', cancel)
    window.removeEventListener('blur', cancel)
    // アプリが開かなかったときだけ、ブラウザ版へ切り替える
    if (!cancelled && document.visibilityState === 'visible') {
      window.location.href = webUrl
    }
  }, 1200)

  // 開けなかった場合に備え、タイマーは必ず解除できるようにしておく
  void timer

  window.location.href = appUrl
}
