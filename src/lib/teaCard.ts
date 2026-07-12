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

// 名刺比率 91:55 ≒ 1.6545（十分な解像度で出力）
const W = 1274
const H = 770

// カードのフォント: いろはマル（MODI工場 / SIL Open Font License 1.1）
// public/fonts/irohamaru/ に同梱。読み込み失敗時は従来のセリフ体にフォールバック。
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

// hex表記を正規化（#付き・大文字・3/4桁は6/8桁に展開）。表示とパレット照合用
export function normalizeHex(hex: string): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
  return '#' + h.toUpperCase()
}

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

// テキストが maxWidth に1行で収まるフォントサイズを返す。
// 基準サイズで測った幅から比例縮小するため、どんな長さでも必ず収まる。
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

// 折り返し行を計算する（描画はしない）。収まりきらない場合は最終行を「…」化
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

export async function generateTeaCard(data: TeaCardData): Promise<Blob> {
  // フォント読み込みを待ってから描画（未ロードだと代替フォントで焼き付いてしまうため）
  await ensureFonts()
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

  // ── 円の下: 筆記体風ブランド → 大きな紅茶名 → 茶園 ──
  // どちらも最大30文字。1行に必ず収まるようフォントサイズを比例縮小する
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  let ny = cupCy + cupR + 26   // カップ下端と被らないよう余白を確保
  if (data.brand_name) {
    const bf = fitFontSize(ctx, data.brand_name, 30, 520, s => `italic 700 ${s}px ${SERIF}`)
    ctx.font = `italic 700 ${bf}px ${SERIF}`
    ctx.fillStyle = '#A8760F'
    ctx.fillText(data.brand_name, 44, ny)
  }
  ny += 62
  const teaNameText = data.tea_name || '（お茶の名前）'
  const nf = fitFontSize(ctx, teaNameText, 58, 510, s => `700 ${s}px ${MINCHO}`)
  ctx.font = `700 ${nf}px ${MINCHO}`
  ctx.fillStyle = '#3B2F20'
  ctx.fillText(teaNameText, 44, ny)
  ny += 24
  if (data.tea_garden) {
    ny += 28
    const gf = fitFontSize(ctx, data.tea_garden, 19, 500, s => `400 ${s}px ${MINCHO}`, 13)
    ctx.font = `400 ${gf}px ${MINCHO}`
    ctx.fillStyle = INK_SOFT
    ctx.fillText(data.tea_garden, 44, ny)
    ny += 6
  }

  // ── 右上: 紅茶名 → 評価者+飲んだ日 → 飲んだ場所 → メモ ──
  const rightX = 600
  const rightW = W - 48 - rightX
  let ty = 76
  // 見出しは紅茶名のみ（ブランドは左側に表示済みのため重複させない）
  const heading = data.tea_name || '（お茶の名前）'
  let headFont = 30
  for (const fs of [30, 28, 26, 24, 22, 20, 18, 16]) {
    ctx.font = `700 ${fs}px ${MINCHO}`
    if (computeLines(ctx, heading, rightW, 99).length <= 2) { headFont = fs; break }
    headFont = fs
  }
  ctx.font = `700 ${headFont}px ${MINCHO}`
  ctx.fillStyle = '#3B2F20'
  const headLh = Math.round(headFont * 1.4)
  const headLines = wrapText(ctx, heading, rightX, ty, rightW, headLh, 2)
  ty += (headLines - 1) * headLh + 34

  // 評価者（Tea taster ユーザ名）と、その右に飲んだ日 yyyy/mm/dd
  const drankDate = data.drank_at ? data.drank_at.slice(0, 10).replace(/-/g, '/') : ''
  const tasterLine = [
    data.user_name ? `Tea taster ${data.user_name}` : '',
    drankDate,
  ].filter(Boolean).join('　　')
  if (tasterLine) {
    const tf = fitFontSize(ctx, tasterLine, 21, rightW, s => `italic 400 ${s}px ${SERIF}`, 14)
    ctx.font = `italic 400 ${tf}px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    wrapText(ctx, tasterLine, rightX, ty, rightW, tf + 4, 1)
    ty += 32
  }

  // 飲んだ場所（未設定なら非表示）
  if (data.shop_name) {
    const shopLine = `at ${data.shop_name}`
    const sf = fitFontSize(ctx, shopLine, 21, rightW, s => `italic 400 ${s}px ${SERIF}`, 14)
    ctx.font = `italic 400 ${sf}px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    wrapText(ctx, shopLine, rightX, ty, rightW, sf + 4, 1)
    ty += 32
  }
  ty += 4

  if (data.comment) {
    // レーダーチャート上端より手前までが本文エリア。
    // コメントは最大300字。長さに応じて文字サイズを段階的に下げ、
    // 300字でも省略されずに収まるサイズを自動選択する。
    const radarTopY = H - 235 - 105 - 34   // レーダー中心 - 半径 - ラベル余白
    const available = radarTopY - 14 - ty
    const maxW = W - 48 - rightX
    const candidates: Array<[number, number]> = [[22, 36], [20, 32], [18, 28], [16, 25], [15, 23], [14, 21]]
    let chosen = candidates[candidates.length - 1]
    for (const [fs, lh] of candidates) {
      ctx.font = `400 ${fs}px ${MINCHO}`
      const lines = computeLines(ctx, data.comment, maxW, 99)
      if (lines.length * lh <= available) { chosen = [fs, lh]; break }
    }
    const [fs, lh] = chosen
    ctx.font = `400 ${fs}px ${MINCHO}`
    ctx.fillStyle = INK
    wrapText(ctx, data.comment, rightX, ty, maxW, lh, Math.max(1, Math.floor(available / lh)))
  }

  // ── 下段中央右: レーダーチャート ──
  const radarCx = 745, radarCy = H - 235
  drawRadar(ctx, radarCx, radarCy, 105,
    [data.score_aroma, data.score_sweetness, data.score_richness, data.score_astringency],
    ['香り', '甘み', 'コク', '渋み'])

  // ── レーダーの右横: 香り分析 + 水色 + 淹れ方 + 添え物 ──
  // drawRadar内でtextAlignがcenterに変わっているため、必ず左揃えに戻す
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const secX = radarCx + 105 + 34 + 60   // レーダー右ラベルの外側から開始
  const secW = W - 44 - secX
  let sy = radarCy - 105 - 20            // レーダー上端と揃える
  const section = (title: string, body: string) => {
    ctx.font = `700 17px ${MINCHO}`
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText(title, secX, sy)
    sy += 27
    ctx.font = `400 17px ${MINCHO}`
    ctx.fillStyle = INK
    const used = wrapText(ctx, body, secX, sy, secW, 24, 3)
    sy += used * 24 + 12
  }
  if (data.aroma_notes && data.aroma_notes.length) {
    section('― 香り分析 ―', data.aroma_notes.slice(0, 8).join('・'))
  }
  // 水色: パレット登録色なら色名、未登録なら「カスタム」。右にカラーコードと色見本
  if (data.color_hex) {
    const hexNorm = normalizeHex(data.color_hex)
    ctx.font = `700 17px ${MINCHO}`
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText('― 水色 ―', secX, sy)
    sy += 27
    ctx.font = `400 17px ${MINCHO}`
    ctx.fillStyle = INK
    const label = `${data.color_name || 'カスタム'}　${hexNorm}`
    ctx.fillText(label, secX, sy)
    // ラベルの右に小さな色見本を描く
    const labelW = ctx.measureText(label).width
    const swX = secX + labelW + 10
    if (swX + 20 <= W - 44) {
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
    section('― 淹れ方 ―', details.join(' / '))
  }
  if (data.accompaniments && data.accompaniments.length) {
    section('― 添え物 ―', data.accompaniments.slice(0, 5).join('・'))
  }

  // ── 左下: フッター（クレジット・生成日時・リンク） ──
  const now = new Date()
  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
  ctx.font = `400 15px ${SERIF}`
  ctx.fillStyle = INK_SOFT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const footer = [
    '© 2026 My-Teas',
    `Generated: ${jst} JST`,
    'Website: https://my-teas-omega.vercel.app',
    'X: @myteas_kbk',
  ]
  footer.forEach((line, i) => ctx.fillText(line, 44, H - 106 + i * 21))

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 0.95))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
