/**
 * 評価の管理番号（review_no）の表示形式をそろえるための関数。（v375）
 *
 * カードへの印字と、サイトの検索・表示で形式がずれると
 * 「カードの番号を入れても見つからない」ことになるため、必ずここを通す。
 *
 * ── 接頭辞について ──
 * 番号そのものは「どの評価か」を指すものなので、
 * 同じ評価から作られたカードは誰が出力しても番号部分は同じになる。
 * 接頭辞だけを変えて、そのカードが自分の記録か、集めたものかを示す。
 *
 *   MY-00000010  自分が記録した評価から作ったカード
 *   CO-00000010  他の人の評価を集めて作ったカード（同じ評価なので数字は同じ）
 *
 * ── 桁数について ──
 * 8桁で 1〜99,999,999（約1億件）まで扱える。
 * 列は bigint なので、桁が足りなくなったら表示側を広げるだけでよい。
 * その場合も parseReviewNo は数字だけを取り出すため、
 * 既に印刷された8桁のカードは引き続き検索できる。
 */

/** カードの種類。teaCard の variant と対応する */
export type ReviewNoKind = 'own' | 'collected'

const PREFIX: Record<ReviewNoKind, string> = {
  own: 'MY',
  collected: 'CO',
}

const DIGITS = 8

/** 10 → "MY-00000010" / "CO-00000010" */
export function formatReviewNo(
  no: number | null | undefined,
  kind: ReviewNoKind = 'own',
): string {
  if (no == null) return ''
  return `${PREFIX[kind]}-${String(no).padStart(DIGITS, '0')}`
}

/**
 * 利用者が入力した文字列から番号を取り出す。
 *
 * カードを見ながら手入力する前提なので、表記ゆれを幅広く受ける。
 *   "MY-00000010" / "CO-00000010" / "my00000010" / "No. MY-00000010"
 *   "00000010" / "10"
 * いずれも 10 として扱う。
 *
 * ★ 接頭辞は無視する。番号が同じなら指している評価も同じなので、
 *   MY/CO のどちらで入力されても同じ評価に当たるのが正しい。
 */
export function parseReviewNo(input: string): number | null {
  if (!input) return null
  const half = input.replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
  const m = half.match(/\d+/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** 入力が「番号での検索」に見えるか。検索欄で分岐するのに使う。 */
export function looksLikeReviewNo(input: string): boolean {
  const t = input.trim().replace(/^no\.?\s*/i, '')
  if (!t) return false
  // MY- / CO- で始まる、または数字だけ（茶葉名に数字が混ざる場合と区別する）
  return /^((my|co)[-\s]?)?\d+$/i.test(t)
}
