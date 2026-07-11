// ─────────────────────────────────────────────────────────
// 評価カード画像生成
//
// 自分の評価データ（お茶の名前・水色・スコア・香りノート・詳細入力など）を
// 1枚のPNG画像（カード）に描き出す。実際の紅茶パッケージに付いてくる
// テイスティングカードのレイアウトを参考にしている。
//
//   ┌─────────────┬───────────────────────┐
//   │  カップ(水色) │  紅茶名 / ブランド / 店   │
//   │             │  ─────────────────    │
//   │             │  メモ                  │
//   ├─────────────┼───────────────────────┤
//   │ 香りノート     │                       │
//   │ 詳細入力      │      レーダーチャート     │
//   └─────────────┴───────────────────────┘
//
// react-chartjs-2 / TeaCup(SVG) は画面表示専用のため、書き出し用に
// 同じ見た目をcanvas APIで再現している（TeaCupのグラデーション計算ロジックを流用）。
// ─────────────────────────────────────────────────────────

export interface TeaCardData {
  tea_name: string
  brand_name?: string | null
  shop_name?: string | null
  color_hex?: string | null
  comment?: string | null
  aroma_notes?: string[] | null
  brew_method?: string | null
  steep_seconds?: number | null
  tea_grams_per_100ml?: number | null
  accompaniments?: string[] | null
  score_aroma: number
  score_astringency: number
  score_richness: number
  score_sweetness: number
}

const W = 1000
const H = 640
const PAD = 48

function parseHex(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
  if (h.length !== 6 && h.length !== 8) return [200, 169, 110, 1]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  if ([r, g, b].some(isNaN)) return [200, 169, 110, 1]
  return [r, g, b, isNaN(a) ? 1 : a]
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)]
}
const rgbStr = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`

// TeaCup.tsx と同じ計算式でカップを描く（見た目を統一するため）
function drawCup(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hex: string) {
  const [rr, gg, bb, a] = parseHex(hex)
  const base = mix([rr, gg, bb], [248, 242, 230], 1 - a)
  const deep = mix(base, [30, 12, 4], 0.35)
  const edge = mix(base, [255, 238, 205], 0.5)
  const edgeRim = mix(base, [255, 246, 228], 0.75)

  // ソーサー
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2)
  ctx.fillStyle = '#f7f3ed'; ctx.fill()
  ctx.lineWidth = 2; ctx.strokeStyle = '#d8cfc4'; ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2)
  ctx.fillStyle = '#efeae2'; ctx.fill()

  // 液面（放射グラデーション）
  const grad = ctx.createRadialGradient(cx, cy - r * 0.07, r * 0.05, cx, cy, r)
  grad.addColorStop(0, rgbStr(deep))
  grad.addColorStop(0.45, rgbStr(mix(deep, base, 0.55)))
  grad.addColorStop(0.8, rgbStr(base))
  grad.addColorStop(0.94, rgbStr(edge))
  grad.addColorStop(1, rgbStr(edgeRim))
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = grad; ctx.fill()

  // 上部の映り込み
  const hi = ctx.createLinearGradient(0, cy - r * 0.55, 0, cy - r * 0.15)
  hi.addColorStop(0, 'rgba(255,255,255,0.35)')
  hi.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.save()
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.37, r * 0.47, r * 0.17, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = hi
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()

  // カップの縁
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2)
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#cdc4b6'; ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2)
  ctx.lineWidth = 2; ctx.strokeStyle = '#bdb4a5'; ctx.stroke()
}

// レーダーチャート（香り・渋み・コク・甘味の4軸、1〜5段階）を描く
function drawRadar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, scores: number[], labels: string[]) {
  const n = scores.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n

  // 目盛りの同心多角形（1〜5）
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = angle(i % n)
      const r = (radius * ring) / 5
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = ring === 5 ? '#C9BFA8' : '#E6DFD0'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 軸線とラベル
  ctx.font = '600 22px sans-serif'
  ctx.fillStyle = '#3A332A'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < n; i++) {
    const a = angle(i)
    const x = cx + radius * Math.cos(a), y = cy + radius * Math.sin(a)
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y)
    ctx.strokeStyle = '#E6DFD0'; ctx.lineWidth = 1; ctx.stroke()
    const lx = cx + (radius + 34) * Math.cos(a), ly = cy + (radius + 34) * Math.sin(a)
    ctx.fillText(labels[i], lx, ly)
  }

  // データ多角形
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = angle(i % n)
    const r = (radius * scores[i % n]) / 5
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(29,158,117,0.22)'
  ctx.fill()
  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 3; ctx.stroke()

  // データ点
  for (let i = 0; i < n; i++) {
    const a = angle(i)
    const r = (radius * scores[i]) / 5
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#1D9E75'; ctx.fill()
  }
}

// 折り返しつきテキスト描画。使った行数を返す
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const chars = text.split('')
  let line = '', lines: string[] = []
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line); line = ch
    } else {
      line = test
    }
    if (lines.length >= maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxWidth - 20) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length
}

export async function generateTeaCard(data: TeaCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 背景
  ctx.fillStyle = '#FBF8F2'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#E6DFD0'; ctx.lineWidth = 2
  ctx.strokeRect(8, 8, W - 16, H - 16)

  // ── 左上：カップ（水色）
  const cupR = 100
  drawCup(ctx, PAD + cupR * 1.3, PAD + cupR * 1.3, cupR, data.color_hex ?? '#C8A96E')

  // ── 右上：紅茶名・ブランド・店
  const rightX = PAD + cupR * 2.6 + 32
  let ty = PAD + 8
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#1D9E75'
  ctx.font = '700 15px sans-serif'
  ctx.fillText('BLACK TEA REVIEW', rightX, ty + 14)
  ty += 40
  ctx.fillStyle = '#2A251E'
  ctx.font = '700 40px sans-serif'
  ctx.fillText(data.tea_name || '（お茶の名前）', rightX, ty)
  ty += 34
  ctx.font = '400 18px sans-serif'
  ctx.fillStyle = '#6B6255'
  const sub = [data.brand_name, data.shop_name].filter(Boolean).join('　/　')
  if (sub) { ctx.fillText(sub, rightX, ty); ty += 30 } else { ty += 12 }

  // 区切り線
  ty += 8
  ctx.strokeStyle = '#E6DFD0'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(rightX, ty); ctx.lineTo(W - PAD, ty); ctx.stroke()
  ty += 32

  // メモ
  if (data.comment) {
    ctx.font = '400 17px sans-serif'
    ctx.fillStyle = '#3A332A'
    wrapText(ctx, data.comment, rightX, ty, W - PAD - rightX, 27, 4)
  }

  // ── 左下：香りノート＋詳細入力
  const bottomY = PAD + cupR * 2.9
  let ly = bottomY
  const leftW = cupR * 2.6
  ctx.font = '700 16px sans-serif'
  ctx.fillStyle = '#1D9E75'
  ctx.fillText('香りノート', PAD, ly)
  ly += 28
  ctx.font = '400 15px sans-serif'
  ctx.fillStyle = '#3A332A'
  if (data.aroma_notes && data.aroma_notes.length) {
    let lx = PAD
    for (const note of data.aroma_notes.slice(0, 8)) {
      const w = ctx.measureText(note).width + 24
      if (lx + w > PAD + leftW) { lx = PAD; ly += 32 }
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1
      ctx.beginPath()
      // @ts-ignore roundRect対応ブラウザ向け
      if (ctx.roundRect) { ctx.roundRect(lx, ly - 20, w - 8, 26, 13); ctx.stroke() }
      else { ctx.strokeRect(lx, ly - 20, w - 8, 26) }
      ctx.fillStyle = '#1D9E75'
      ctx.fillText(note, lx + 10, ly - 2)
      ctx.fillStyle = '#3A332A'
      lx += w
    }
    ly += 40
  } else {
    ctx.fillText('（未入力）', PAD, ly); ly += 32
  }

  ly += 8
  ctx.font = '700 16px sans-serif'
  ctx.fillStyle = '#1D9E75'
  ctx.fillText('淹れ方', PAD, ly)
  ly += 28
  ctx.font = '400 15px sans-serif'
  ctx.fillStyle = '#3A332A'
  const details: string[] = []
  if (data.brew_method) details.push(data.brew_method)
  if (data.tea_grams_per_100ml) details.push(`茶葉 ${data.tea_grams_per_100ml}g/100ml`)
  if (data.steep_seconds) details.push(`蒸らし ${data.steep_seconds}秒`)
  if (data.accompaniments && data.accompaniments.length) details.push(`お供: ${data.accompaniments.join('・')}`)
  if (details.length) {
    details.forEach(d => { ctx.fillText('・' + d, PAD, ly); ly += 24 })
  } else {
    ctx.fillText('（未入力）', PAD, ly)
  }

  // ── 右下：レーダーチャート
  const radarCx = rightX + (W - PAD - rightX) / 2
  const radarCy = H - PAD - 150
  drawRadar(ctx, radarCx, radarCy, 120,
    [data.score_aroma, data.score_sweetness, data.score_richness, data.score_astringency],
    ['香り', '甘味', 'コク', '渋み'])

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 0.95))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
