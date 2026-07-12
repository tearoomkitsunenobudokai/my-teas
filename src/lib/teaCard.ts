// ─────────────────────────────────────────────────────────
// 評価カード画像生成（紅茶専門店スタイル・印刷対応デザイン）
//
// レイアウト（1274×770 / 名刺比率91:55）
//   ・金罫の二重フレーム + 四隅の飾り（印刷時の縁取りとして機能）
//   ・左上: 水色の円（金の二重リングで枠内に収める）
//   ・円の下: ブランド（金・斜体）→ 紅茶名（大）→ 飾り罫 → 茶園
//   ・右上: TASTING CARD → 紅茶名 → Tea taster+飲んだ日 → at 店 → 罫線 → メモ
//   ・右下: レーダーチャート + その右に 香り分析/水色/淹れ方/添え物
//   ・左下: フッター（クレジット・生成日時・リンク）
//
// フォント: いろはマル（SIL OFL 1.1 / public/fonts/irohamaru に同梱）
// ─────────────────────────────────────────────────────────

export interface TeaCardData {
  tea_name: string
  brand_name?: string | null
  tea_garden?: string | null
  shop_name?: string | null
  user_name?: string | null
  drank_at?: string | null
  color_hex?: string | null
  color_name?: string | null
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

// 名刺比率 91:55
const W = 1274
const H = 770

// ── 配色（上質な紅茶サロンのトーン） ──
const INK = '#443528'        // 本文の焦げ茶
const INK_SOFT = '#7A6A55'   // 補助テキスト
const INK_DEEP = '#332618'   // 見出し
const GOLD = '#C9A96E'       // 明るい琥珀
const GOLD_DEEP = '#A8873F'  // 罫線・飾りの金
const ACCENT = '#7E332A'     // バッジの深い臙脂
const CREAM = '#F6F0E4'      // 背景の生成り

// カードのフォント: いろはマル（MODI工場 / SIL Open Font License 1.1）
const SERIF = '"irohamaru", Georgia, "Times New Roman", "Hiragino Mincho ProN", "Yu Mincho", serif'
const MINCHO = '"irohamaru", "Hiragino Mincho ProN", "Yu Mincho", "Georgia", serif'

let fontsLoaded = false
async function ensureFonts(): Promise<void> {
  if (fontsLoaded) return
  try {
    const regular = new FontFace('irohamaru', 'url(/fonts/irohamaru/irohamaru-Regular.woff2)', { weight: '400' })
    const medium  = new FontFace('irohamaru', 'url(/fonts/irohamaru/irohamaru-Medium.woff2)',  { weight: '700' })
    const loaded = await Promise.all([regular.load(), medium.load()])
    loaded.forEach(f => (document.fonts as any).add(f))
    fontsLoaded = true
  } catch {
    // 読み込み失敗時はフォールバックフォントで描画（機能自体は止めない）
  }
}

// ── 色ユーティリティ ──
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

// hex表記を正規化（#付き・大文字・3/4桁は6/8桁に展開）。表示とパレット照合用
export function normalizeHex(hex: string): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
  return '#' + h.toUpperCase()
}

// ── テキストユーティリティ ──
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  baseSize: number,
  maxWidth: number,
  fontOf: (size: number) => string,
  minSize = 12,
): number {
  ctx.font = fontOf(baseSize)
  const w = ctx.measureText(text).width
  if (w <= maxWidth) return baseSize
  return Math.max(minSize, Math.floor(baseSize * maxWidth / w))
}

function computeLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = text.split('')
  const lines: string[] = []
  let line = ''
  let truncated = false

  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines.length + 1 >= maxLines) {
        lines.push(line)
        truncated = true
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

  if (truncated && lines.length) {
    const last = lines.length - 1
    let s = lines[last]
    while (s && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1)
    lines[last] = s + '…'
  }
  return lines
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const lines = computeLines(ctx, text, maxWidth, maxLines)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length
}

// ── 装飾: 二重フレーム + 四隅の飾り ──────────────────────
// 印刷時の縁取りを想定。外は確かな罫、内は繊細な罫、角に菱形と飾り線。
function drawFrame(ctx: CanvasRenderingContext2D) {
  const o = 20   // 外罫
  const i = 30   // 内罫

  ctx.strokeStyle = GOLD_DEEP
  ctx.lineWidth = 2.5
  ctx.strokeRect(o, o, W - o * 2, H - o * 2)

  ctx.strokeStyle = 'rgba(168,135,63,0.55)'
  ctx.lineWidth = 1
  ctx.strokeRect(i, i, W - i * 2, H - i * 2)

  // 四隅: 菱形 + 斜めの飾り線
  const corners: Array<[number, number, number, number]> = [
    [o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    // 菱形（外罫の角に重ねる）
    ctx.fillStyle = GOLD_DEEP
    ctx.beginPath()
    ctx.moveTo(cx, cy - 7)
    ctx.lineTo(cx + 7, cy)
    ctx.lineTo(cx, cy + 7)
    ctx.lineTo(cx - 7, cy)
    ctx.closePath()
    ctx.fill()
    // 内向きの飾り線（2本）
    ctx.strokeStyle = 'rgba(168,135,63,0.7)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(cx + dx * 16, cy + dy * 16)
    ctx.lineTo(cx + dx * 38, cy + dy * 16)
    ctx.moveTo(cx + dx * 16, cy + dy * 16)
    ctx.lineTo(cx + dx * 16, cy + dy * 38)
    ctx.stroke()
  }
}

// ── 装飾: ダマスク柄風の淡い植物模様（背景） ──
function drawDamask(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.strokeStyle = 'rgba(180,150,100,0.08)'
  ctx.fillStyle = 'rgba(180,150,100,0.04)'
  ctx.lineWidth = 2

  const flower = (cx: number, cy: number, r: number) => {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      ctx.beginPath()
      ctx.ellipse(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a),
        r * 0.42, r * 0.2, a, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  const vine = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke()
  }
  flower(W * 0.52, H * 0.50, 110)
  flower(W * 0.68, H * 0.26, 62)
  flower(W * 0.88, H * 0.82, 44)
  vine(W * 0.46, H * 0.84, W * 0.52, H * 0.58, W * 0.63, H * 0.40)
  ctx.restore()
}

// ── 水色の円（金の二重リング付き・枠内に収める構図） ──
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

  // 液面下部の照り返し
  const sheen = ctx.createRadialGradient(cx + r * 0.25, cy + r * 0.45, 0, cx + r * 0.25, cy + r * 0.45, r * 0.6)
  sheen.addColorStop(0, 'rgba(255,225,170,0.35)')
  sheen.addColorStop(1, 'rgba(255,225,170,0)')
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = sheen
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()

  // 金の二重リング
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = GOLD_DEEP; ctx.lineWidth = 4; ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'; ctx.lineWidth = 1.5; ctx.stroke()
}

// ── レーダーチャート ──
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
    ctx.strokeStyle = ring === 5 ? 'rgba(168,135,63,0.75)' : 'rgba(168,135,63,0.30)'
    ctx.lineWidth = ring === 5 ? 1.6 : 1
    ctx.stroke()
  }

  ctx.font = `600 22px ${MINCHO}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < n; i++) {
    const a = angle(i)
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
    ctx.strokeStyle = 'rgba(168,135,63,0.30)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = INK
    ctx.fillText(labels[i], cx + (radius + 32) * Math.cos(a), cy + (radius + 32) * Math.sin(a))
  }

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

// セクション見出し（タイトル + 短い金罫）
function sectionTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number) {
  ctx.font = `700 17px ${MINCHO}`
  ctx.fillStyle = GOLD_DEEP
  ctx.fillText(title, x, y)
  const tw = ctx.measureText(title).width
  ctx.strokeStyle = 'rgba(168,135,63,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + tw + 10, y - 5)
  ctx.lineTo(x + tw + 46, y - 5)
  ctx.stroke()
}

export async function generateTeaCard(data: TeaCardData): Promise<Blob> {
  // フォント読み込みを待ってから描画（未ロードだと代替フォントで焼き付いてしまうため）
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── 背景（生成りグラデーション + ダマスク + 二重フレーム） ──
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#F8F3E8')
  bg.addColorStop(0.5, CREAM)
  bg.addColorStop(1, '#EFE7D4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  drawDamask(ctx)

  // ── 左上: 水色の大円（フレーム内でトリミングして見切れさせる） ──
  // 円自体は紙面より大きく描くが、内罫の内側でクリップすることで
  // 「見切れる」構図とフレームの両立をはかる
  const cupR = 290
  const cupCx = 250, cupCy = 180
  ctx.save()
  ctx.beginPath()
  ctx.rect(31, 31, W - 62, H - 62)
  ctx.clip()
  drawTeaCircle(ctx, cupCx, cupCy, cupR, data.color_hex ?? '#C8A96E')
  ctx.restore()

  // フレームは円の上から描き、金罫が縁として円をトリミングして見えるようにする
  drawFrame(ctx)

  // ── My-Teas バッジ（左上・円の上に重ねる） ──
  ctx.fillStyle = ACCENT
  ctx.fillRect(56, 48, 158, 40)
  ctx.strokeStyle = 'rgba(201,169,110,0.9)'
  ctx.lineWidth = 1
  ctx.strokeRect(60, 52, 150, 32)
  ctx.font = `700 20px ${SERIF}`
  ctx.fillStyle = '#F5EDE0'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('My-Teas', 56 + 79, 48 + 21)

  // ── 円の下: ブランド → 紅茶名 → 飾り罫 → 茶園 ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  let ny = cupCy + cupR + 40
  if (data.brand_name) {
    const bf = fitFontSize(ctx, data.brand_name, 28, 470, s => `italic 700 ${s}px ${SERIF}`)
    ctx.font = `italic 700 ${bf}px ${SERIF}`
    ctx.fillStyle = '#A8760F'
    ctx.fillText(data.brand_name, 64, ny)
  }
  ny += 56
  const teaNameText = data.tea_name || '（お茶の名前）'
  const nf = fitFontSize(ctx, teaNameText, 52, 470, s => `700 ${s}px ${MINCHO}`)
  ctx.font = `700 ${nf}px ${MINCHO}`
  ctx.fillStyle = INK_DEEP
  ctx.fillText(teaNameText, 64, ny)
  if (data.tea_garden) {
    // 飾り罫（短い金線）を挟んで茶園名
    ny += 22
    ctx.strokeStyle = 'rgba(168,135,63,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(64, ny); ctx.lineTo(64 + 64, ny); ctx.stroke()
    ny += 26
    const gf = fitFontSize(ctx, data.tea_garden, 19, 460, s => `400 ${s}px ${MINCHO}`, 13)
    ctx.font = `400 ${gf}px ${MINCHO}`
    ctx.fillStyle = INK_SOFT
    ctx.fillText(data.tea_garden, 64, ny)
  }

  // ── 右上: TASTING CARD → 紅茶名 → 評価者/飲んだ日 → 場所 → 罫 → メモ ──
  const rightX = 560
  const rightW = W - 64 - rightX
  // アイライン（小さな英字見出し）
  ctx.font = `700 13px ${SERIF}`
  ctx.fillStyle = GOLD_DEEP
  ctx.fillText('T A S T I N G   C A R D', rightX, 84)

  let ty = 118
  const heading = data.tea_name || '（お茶の名前）'
  let headFont = 30
  for (const fs of [30, 28, 26, 24, 22, 20, 18, 16]) {
    ctx.font = `700 ${fs}px ${MINCHO}`
    if (computeLines(ctx, heading, rightW, 99).length <= 2) { headFont = fs; break }
    headFont = fs
  }
  ctx.font = `700 ${headFont}px ${MINCHO}`
  ctx.fillStyle = INK_DEEP
  const headLh = Math.round(headFont * 1.4)
  const headLines = wrapText(ctx, heading, rightX, ty, rightW, headLh, 2)
  ty += (headLines - 1) * headLh + 30

  const drankDate = data.drank_at ? data.drank_at.slice(0, 10).replace(/-/g, '/') : ''
  const tasterLine = [
    data.user_name ? `Tea taster ${data.user_name}` : '',
    drankDate,
  ].filter(Boolean).join('　　')
  if (tasterLine) {
    const tf = fitFontSize(ctx, tasterLine, 20, rightW, s => `italic 400 ${s}px ${SERIF}`, 14)
    ctx.font = `italic 400 ${tf}px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    wrapText(ctx, tasterLine, rightX, ty, rightW, tf + 4, 1)
    ty += 28
  }
  if (data.shop_name) {
    const shopLine = `at ${data.shop_name}`
    const sf = fitFontSize(ctx, shopLine, 20, rightW, s => `italic 400 ${s}px ${SERIF}`, 14)
    ctx.font = `italic 400 ${sf}px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    wrapText(ctx, shopLine, rightX, ty, rightW, sf + 4, 1)
    ty += 28
  }
  // メモの前に細い罫線
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(rightX, ty - 8); ctx.lineTo(rightX + rightW, ty - 8); ctx.stroke()
  ty += 16

  // ── レーダー配置（先に決めて本文エリアの下限に使う） ──
  const radarCx = 745
  const radarCy = H - 235
  const radarR = 100

  if (data.comment) {
    // コメントは最大300字。長さに応じて文字サイズを自動選択して必ず収める
    const radarTopY = radarCy - radarR - 32
    const available = radarTopY - 14 - ty
    const candidates: Array<[number, number]> = [[22, 36], [20, 32], [18, 28], [16, 25], [15, 23], [14, 21], [13, 19]]
    let chosen = candidates[candidates.length - 1]
    for (const [fs, lh] of candidates) {
      ctx.font = `400 ${fs}px ${MINCHO}`
      const lines = computeLines(ctx, data.comment, rightW, 99)
      if (lines.length * lh <= available) { chosen = [fs, lh]; break }
    }
    const [fs, lh] = chosen
    ctx.font = `400 ${fs}px ${MINCHO}`
    ctx.fillStyle = INK
    wrapText(ctx, data.comment, rightX, ty, rightW, lh, Math.max(1, Math.floor(available / lh)))
  }

  // ── 右下: レーダーチャート ──
  drawRadar(ctx, radarCx, radarCy, radarR,
    [data.score_aroma, data.score_sweetness, data.score_richness, data.score_astringency],
    ['香り', '甘み', 'コク', '渋み'])

  // ── レーダーの右横: 香り分析 + 水色 + 淹れ方 + 添え物 ──
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const secX = radarCx + radarR + 32 + 52
  const secW = W - 64 - secX
  let sy = radarCy - radarR - 26
  const section = (title: string, body: string) => {
    sectionTitle(ctx, title, secX, sy)
    sy += 27
    ctx.font = `400 17px ${MINCHO}`
    ctx.fillStyle = INK
    const used = wrapText(ctx, body, secX, sy, secW, 24, 2)
    sy += used * 24 + 12
  }
  if (data.aroma_notes && data.aroma_notes.length) {
    section('香り分析', data.aroma_notes.slice(0, 8).join('・'))
  }
  // 水色: パレット登録色なら色名、未登録なら「カスタム」。右にカラーコードと色見本
  if (data.color_hex) {
    const hexNorm = normalizeHex(data.color_hex)
    sectionTitle(ctx, '水色', secX, sy)
    sy += 27
    ctx.font = `400 17px ${MINCHO}`
    ctx.fillStyle = INK
    const label = `${data.color_name || 'カスタム'}　${hexNorm}`
    ctx.fillText(label, secX, sy)
    const labelW = ctx.measureText(label).width
    const swX = secX + labelW + 10
    if (swX + 20 <= W - 64) {
      const [sr, sg, sb, sa] = parseHex(hexNorm)
      const sbase = mix([sr, sg, sb], [248, 242, 230], 1 - sa)
      ctx.fillStyle = rgbStr(sbase)
      ctx.fillRect(swX, sy - 14, 18, 18)
      ctx.strokeStyle = GOLD_DEEP
      ctx.lineWidth = 1
      ctx.strokeRect(swX, sy - 14, 18, 18)
    }
    sy += 24 + 12
  }
  const details: string[] = []
  if (data.brew_method) details.push(data.brew_method)
  if (data.tea_grams_per_100ml) details.push(`${data.tea_grams_per_100ml}g/100ml`)
  if (data.steep_seconds) details.push(`${data.steep_seconds}秒`)
  if (details.length) {
    section('淹れ方', details.join(' / '))
  }
  if (data.accompaniments && data.accompaniments.length) {
    section('添え物', data.accompaniments.slice(0, 5).join('・'))
  }

  // ── 左下: フッター（上に細罫を敷く） ──
  const now = new Date()
  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(64, H - 132); ctx.lineTo(64 + 300, H - 132); ctx.stroke()
  ctx.font = `400 14px ${SERIF}`
  ctx.fillStyle = INK_SOFT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const footer = [
    '© 2026 My-Teas',
    `Generated: ${jst} JST`,
    'Website: https://my-teas-omega.vercel.app',
    'X: @myteas_kbk',
  ]
  footer.forEach((line, i) => ctx.fillText(line, 64, H - 110 + i * 19))

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 0.95))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
