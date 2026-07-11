// ─────────────────────────────────────────────────────────
// 評価カード画像生成（テイスティングカード風デザイン）
//
// 市販の紅茶テイスティングカードを参考にしたレイアウト:
//   ・左上: 水色（すいしょく）の大きな円が紙面からはみ出すように配置
//   ・カード上部に BLACK TEA バッジ
//   ・左: 筆記体風の産地/ブランド + 大きなセリフ体の紅茶名
//   ・右上: 紅茶名(和文見出し) → メモ本文
//   ・右下: レーダーチャート
//   ・左下: 香りノート + 淹れ方詳細
//   ・背景: 生成り色 + ダマスク柄風の淡い装飾
//   ・サイズ: 名刺比率 (91:55)
// ─────────────────────────────────────────────────────────

export interface TeaCardData {
  tea_name: string
  brand_name?: string | null
  shop_name?: string | null
  user_name?: string | null
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

// 名刺比率 91:55 ≒ 1.6545（十分な解像度で出力）
const W = 1274
const H = 770

const SERIF = 'Georgia, "Times New Roman", "Hiragino Mincho ProN", "Yu Mincho", serif'
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Georgia", serif'

const INK = '#4A3B2A'        // 本文の焦げ茶
const INK_SOFT = '#7A6A55'   // 補助テキスト
const GOLD = '#C9A96E'       // 装飾・チャートの琥珀
const GOLD_DEEP = '#B08A48'
const CREAM = '#F5EFE3'      // 背景の生成り

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

// ── 背景: ダマスク柄風の淡い植物装飾 ──────────────────────
// 手前の情報を邪魔しないよう、ごく薄い琥珀色の線だけで描く
function drawDamask(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.strokeStyle = 'rgba(180,150,100,0.10)'
  ctx.fillStyle = 'rgba(180,150,100,0.05)'
  ctx.lineWidth = 2

  // 花のモチーフ（中心円＋8枚の花びら）を描くヘルパー
  const flower = (cx: number, cy: number, r: number) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      ctx.beginPath()
      ctx.ellipse(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a),
        r * 0.42, r * 0.2, a, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // 蔓（つる）: ゆるやかな曲線
  const vine = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke()
  }

  // 右中央〜中央にかけて大きめの花と蔓（サンプルカードの雰囲気）
  flower(W * 0.56, H * 0.52, 120)
  flower(W * 0.70, H * 0.30, 70)
  flower(W * 0.47, H * 0.78, 60)
  vine(W * 0.45, H * 0.9, W * 0.52, H * 0.62, W * 0.62, H * 0.44)
  vine(W * 0.62, H * 0.44, W * 0.7, H * 0.36, W * 0.76, H * 0.24)
  // 右下にも小さく
  flower(W * 0.88, H * 0.86, 46)

  ctx.restore()
}

// ── 水色の円（サンプル同様、金の縁取り付きでカード左上からはみ出す） ──
function drawTeaCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hex: string) {
  const [rr, gg, bb, a] = parseHex(hex)
  const base = mix([rr, gg, bb], [248, 242, 230], 1 - a)
  const deep = mix(base, [30, 12, 4], 0.35)
  const edge = mix(base, [255, 238, 205], 0.5)

  // 液面
  const grad = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.15, r * 0.05, cx, cy, r)
  grad.addColorStop(0, rgbStr(deep))
  grad.addColorStop(0.5, rgbStr(mix(deep, base, 0.6)))
  grad.addColorStop(0.85, rgbStr(base))
  grad.addColorStop(1, rgbStr(edge))
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = grad; ctx.fill()

  // 液面下部の明るい照り返し（サンプル写真の質感）
  const sheen = ctx.createRadialGradient(cx + r * 0.25, cy + r * 0.45, 0, cx + r * 0.25, cy + r * 0.45, r * 0.6)
  sheen.addColorStop(0, 'rgba(255,225,170,0.4)')
  sheen.addColorStop(1, 'rgba(255,225,170,0)')
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = sheen
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()

  // 金の縁取り（二重線）
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = GOLD_DEEP; ctx.lineWidth = 5; ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(201,169,110,0.5)'; ctx.lineWidth = 2; ctx.stroke()
}

// ── レーダーチャート（琥珀色・サンプルの雰囲気） ──────────────
function drawRadar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, scores: number[], labels: string[]) {
  const n = scores.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n

  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = angle(i % n)
      const r = (radius * ring) / 5
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = ring === 5 ? 'rgba(176,138,72,0.75)' : 'rgba(176,138,72,0.35)'
    ctx.lineWidth = ring === 5 ? 1.6 : 1
    ctx.stroke()
  }

  ctx.font = `600 24px ${MINCHO}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < n; i++) {
    const a = angle(i)
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
    ctx.strokeStyle = 'rgba(176,138,72,0.35)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = INK
    ctx.fillText(labels[i], cx + (radius + 36) * Math.cos(a), cy + (radius + 36) * Math.sin(a))
  }

  // データ多角形（琥珀の塗り）
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = angle(i % n)
    const r = (radius * scores[i % n]) / 5
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(201,169,110,0.30)'
  ctx.fill()
  ctx.strokeStyle = GOLD_DEEP; ctx.lineWidth = 2.5; ctx.stroke()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const chars = text.split('')
  const lines: string[] = []
  let line = ''
  let truncated = false

  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      // 現在の行が埋まった。これ以上行を増やせないなら、残りは入りきらない
      if (lines.length + 1 >= maxLines) {
        lines.push(line)
        truncated = true      // まだ文字が残っている＝切り捨てが発生
        line = ''
        break
      }
      lines.push(line)
      line = chars[i]
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  // 実際に収まりきらなかった場合のみ末尾を「…」にする
  if (truncated && lines.length) {
    const last = lines.length - 1
    let s = lines[last]
    while (s && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1)
    lines[last] = s + '…'
  }

  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length
}

export async function generateTeaCard(data: TeaCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── 背景（生成りのグラデーション + ダマスク柄） ──
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#F7F1E6')
  bg.addColorStop(0.5, CREAM)
  bg.addColorStop(1, '#EFE6D4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  drawDamask(ctx)

  // ── 左上: 水色の大円（紙面左上からはみ出す） ──
  const cupR = 300
  const cupCx = 250, cupCy = 190
  drawTeaCircle(ctx, cupCx, cupCy, cupR, data.color_hex ?? '#C8A96E')

  // ── My-Teas バッジ（左上） ──
  ctx.fillStyle = '#8E3B2F'
  ctx.fillRect(36, 34, 150, 38)
  ctx.font = `700 20px ${SERIF}`
  ctx.fillStyle = '#F5EDE0'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.letterSpacing = '2px' as any
  ctx.fillText('My-Teas', 36 + 75, 34 + 20)
  ctx.letterSpacing = '0px' as any

  // ── 円の下: 筆記体風ブランド → 大きな紅茶名 ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  let ny = cupCy + cupR - 40
  if (data.brand_name) {
    ctx.font = `italic 700 30px ${SERIF}`
    ctx.fillStyle = '#A8760F'
    ctx.fillText(data.brand_name, 44, ny)
  }
  ny += 62
  ctx.font = `700 58px ${MINCHO}`
  ctx.fillStyle = '#3B2F20'
  // 茶名が長い場合は縮小
  let nameFont = 58
  while (ctx.measureText(data.tea_name || '').width > 480 && nameFont > 30) {
    nameFont -= 4
    ctx.font = `700 ${nameFont}px ${MINCHO}`
  }
  ctx.fillText(data.tea_name || '（お茶の名前）', 44, ny)
  ny += 24

  // ── 左下: 香りノート + 淹れ方 + 添え物 ──
  // 3セクションを縦積み。内容が多い場合は2行まで折り返す。
  let ly = Math.max(ny + 20, H - 250)
  const section = (title: string, body: string) => {
    ctx.font = `700 17px ${MINCHO}`
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText(title, 44, ly)
    ly += 26
    ctx.font = `400 18px ${MINCHO}`
    ctx.fillStyle = INK
    const used = wrapText(ctx, body, 44, ly, 520, 25, 2)
    ly += used * 25 + 14
  }
  if (data.aroma_notes && data.aroma_notes.length) {
    section('― 香りノート ―', data.aroma_notes.slice(0, 8).join('・'))
  }
  const details: string[] = []
  if (data.brew_method) details.push(data.brew_method)
  if (data.tea_grams_per_100ml) details.push(`${data.tea_grams_per_100ml}g/100ml`)
  if (data.steep_seconds) details.push(`${data.steep_seconds}秒`)
  if (details.length) {
    section('― 淹れ方 ―', details.join(' / '))
  }
  if (data.accompaniments && data.accompaniments.length) {
    section('― 添え物 ―', data.accompaniments.slice(0, 5).join('・'))
  }

  // ── 右上: 見出し（紅茶名+ブランド） → By ユーザ名・店 → メモ ──
  const rightX = 600
  let ty = 76
  ctx.font = `700 32px ${MINCHO}`
  ctx.fillStyle = '#3B2F20'
  const heading = [data.tea_name, data.brand_name].filter(Boolean).join(' ')
  const headLines = wrapText(ctx, heading, rightX, ty, W - 48 - rightX, 44, 2)
  ty += (headLines - 1) * 44 + 34

  const byLine = [
    data.user_name ? `By ${data.user_name}` : '',
    data.shop_name ? `at ${data.shop_name}` : '',
  ].filter(Boolean).join('　')
  if (byLine) {
    ctx.font = `italic 400 21px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    ctx.fillText(byLine, rightX, ty)
    ty += 36
  }

  if (data.comment) {
    ctx.font = `400 22px ${MINCHO}`
    ctx.fillStyle = INK
    // 見出しが2行のときは本文を1行減らし、レーダーの上ラベルと重ならないようにする
    wrapText(ctx, data.comment, rightX, ty, W - 48 - rightX, 36, headLines > 1 ? 4 : 5)
  }

  // ── 右下: レーダーチャート ──
  drawRadar(ctx, W - 240, H - 280, 130,
    [data.score_aroma, data.score_sweetness, data.score_richness, data.score_astringency],
    ['香り', '甘み', 'コク', '渋み'])

  // ── 右下最下部: フッター（クレジット・生成日時・リンク） ──
  const now = new Date()
  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now).replace(/\//g, '/').replace(' ', ' ')
  ctx.font = `400 15px ${SERIF}`
  ctx.fillStyle = INK_SOFT
  ctx.textAlign = 'right'
  const footer = [
    '© 2026 My-Teas',
    `Generated: ${jst} JST`,
    'Website: https://my-teas-omega.vercel.app',
    'X: @myteas_kbk',
  ]
  footer.forEach((line, i) => ctx.fillText(line, W - 40, H - 92 + i * 21))
  ctx.textAlign = 'left'

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 0.95))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
