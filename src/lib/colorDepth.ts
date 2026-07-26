// 水色（すいしょく）のカラーコードから、レーダーチャート用の「濃さ」スコア(0〜5)を算出する。
//
// ミルクを入れたときに色が残るかどうかは、水色が薄いか濃いかで判断できるため、
// 濃い水色ほど高いスコアになるようにしている（薄い=0に近い、濃い=5に近い）。

function parseHexColor(hex: string): [number, number, number, number] {
  let h = (hex ?? '').replace('#', '').trim()
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  return [
    Number.isNaN(r) ? 200 : r,
    Number.isNaN(g) ? 169 : g,
    Number.isNaN(b) ? 110 : b,
    Number.isNaN(a) ? 1 : a,
  ]
}

/**
 * カラーコードから「濃さ」を0〜5の数値で返す。
 * 明るい（薄い）色ほど低く、暗い（濃い）色ほど高くなる。
 * hexが未設定の場合は中間値(2.5)を返す。
 */
export function colorDepthScore(hex?: string | null): number {
  if (!hex) return 2.5
  const [r, g, b, a] = parseHexColor(hex)
  // 半透明の場合は、生成り色の背景(カード背景と同じ)と混ぜてから明るさを見る
  // （実際にカップに注いだときの見た目の濃さに近づけるため）
  const bg: [number, number, number] = [248, 242, 230]
  const mr = r * a + bg[0] * (1 - a)
  const mg = g * a + bg[1] * (1 - a)
  const mb = b * a + bg[2] * (1 - a)
  // 知覚輝度（明るいほど値が大きい）
  const luminance = 0.299 * mr + 0.587 * mg + 0.114 * mb // 0(黒)〜255(白)
  const depth = ((255 - luminance) / 255) * 5
  return Math.max(0, Math.min(5, Math.round(depth * 10) / 10))
}

/** 濃さスコアを「薄い／やや薄い／普通／やや濃い／濃い」のような一言に変換する（補助表示用） */
export function colorDepthLabel(score: number): string {
  if (score <= 1) return '薄い'
  if (score <= 2) return 'やや薄い'
  if (score <= 3) return '普通'
  if (score <= 4) return 'やや濃い'
  return '濃い'
}
