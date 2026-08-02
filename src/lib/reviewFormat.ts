/**
 * 評価の表示用フォーマットをまとめたヘルパー。
 * 評価カード・一覧・詳細のどこから使っても同じ表記になるようにする。
 */

/**
 * 茶園と原産国をまとめて1つの文字列にする。
 *   茶園あり・原産国あり → 「デジュー農園（インド）」
 *   茶園あり・原産国なし → 「デジュー農園」
 *   茶園なし・原産国あり → 「インド」（括弧は付けない）
 *   どちらもなし         → ''
 */
export function formatGardenOrigin(
  garden?: string | null,
  origin?: string | null,
): string {
  const g = (garden ?? '').trim()
  const o = (origin ?? '').trim()
  if (g && o) return `${g}（${o}）`
  if (g) return g
  if (o) return o
  return ''
}

/**
 * 茶葉量と水量の表記を組み立てる。
 *   g・ml 両方あり → 「5g / 200ml」
 *   g のみ         → 「5g」
 *   ml のみ        → 「200ml」
 *   どちらもなし   → 旧形式（g/100ml）があればそれを表示。なければ ''
 *
 * 旧データは「g/100ml」という比率で保存されているため、
 * 新形式と混同しないよう単位を明記したまま表示する。
 */
export function formatLeafWater(
  grams?: number | null,
  waterMl?: number | null,
  legacyPer100ml?: number | null,
): string {
  const parts: string[] = []
  if (grams != null) parts.push(`${grams}g`)
  if (waterMl != null) parts.push(`${waterMl}ml`)
  if (parts.length) return parts.join(' / ')
  if (legacyPer100ml != null) return `${legacyPer100ml}g/100ml`
  return ''
}
