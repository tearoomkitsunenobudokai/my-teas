/**
 * 評価の管理番号（review_no）の表示形式をそろえるための関数。（v375）
 *
 * カードへの印字と、サイトの検索・表示で形式がずれると
 * 「カードの番号を入れても見つからない」ことになるため、必ずここを通す。
 */

/** 123 → "MT-000123" */
export function formatReviewNo(no: number | null | undefined): string {
  if (no == null) return ''
  return `MT-${String(no).padStart(6, '0')}`
}

/**
 * 利用者が入力した文字列から番号を取り出す。
 *
 * カードを見ながら手入力する前提なので、表記ゆれを幅広く受ける。
 *   "MT-000123" / "mt000123" / "No. MT-000123" / "000123" / "123"
 * いずれも 123 として扱う。数字が見つからなければ null。
 */
export function parseReviewNo(input: string): number | null {
  if (!input) return null
  const digits = input.replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  ).match(/\d+/)
  if (!digits) return null
  const n = Number(digits[0])
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** 入力が「番号での検索」に見えるか。検索欄で分岐するのに使う。 */
export function looksLikeReviewNo(input: string): boolean {
  const t = input.trim()
  if (!t) return false
  // MT- で始まる、または数字だけ（茶葉名に数字が混ざる場合と区別する）
  return /^(mt[-\s]?)?\d+$/i.test(t.replace(/^no\.?\s*/i, ''))
}
