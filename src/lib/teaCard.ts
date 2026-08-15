// ─────────────────────────────────────────────────────────
// 評価カード画像生成（紅茶専門店スタイル・印刷対応デザイン）
//
// レイアウト（1274×770 / 名刺比率91:55）
//   ・金罫の二重フレーム + 四隅の飾り（印刷時の縁取りとして機能）
//   ・左上: 水色の円（金の二重リングで枠内に収める）
//   ・円の下: ブランド（金・斜体）→ 紅茶名（大）→ 飾り罫 → 茶園
//   ・右上: TASTING CARD（右端に飲んだ日）→ 紅茶名 → Tea taster + at 店
//           → 罫線 → メモ
//   ・右下: レーダーチャート + その右に 香り分析/水色/淹れ方/添え物を
//           細い金罫の角丸枠で囲って縦に並べる（見出しは枠の上辺に重ねる）
//   ・淹れ方/添え物の枠は右側に画像用の正方形（ICON）を常に確保する。
//     画像を後から public/icons/ に置いてもレイアウトが動かないようにするため。
//   ・左下: フッター（クレジット・生成日時・リンク）
//
// フォント: いろはマル（SIL OFL 1.1 / public/fonts/irohamaru に同梱）
// ─────────────────────────────────────────────────────────

import { brewIconPath, accompanimentIconPath, accompanimentShortLabel, ACCOMPANIMENT_ORDER, BREW_FILLER_ICON } from './icons'
import { formatGardenOrigin } from './reviewFormat'

export interface TeaCardData {
  tea_name: string
  brand_name?: string | null
  tea_garden?: string | null
  origin_country?: string | null
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
  tea_grams?: number | null
  water_ml?: number | null
  accompaniments?: string[] | null
  score_aroma: number
  score_astringency: number
  score_richness: number
  score_color_depth: number
  /** カードの種類（省略時は自分の記録） */
  variant?: TeaCardVariant
  /** 集めた人の表示名（variant='collection' のときだけ使う） */
  collected_by?: string | null
}

// 名刺比率 91:55
const W = 1274
const H = 770

/**
 * カードの種類。
 *   normal     … 自分の記録（従来のカード。生成りの地に金）
 *   collection … 他の人の評価を集めたカード（淡い藍の地に金）
 *
 * 集めたカードは、印刷して並べたときに自分のものと一目で区別できるよう、
 * 地の色と文字色だけを寒色に振っている。金の罫と金のアイコンは共通なので、
 * アイコン画像を差し替える必要はない。
 */
export type TeaCardVariant = 'normal' | 'collection'

interface CardTheme {
  INK: string; INK_SOFT: string; INK_DEEP: string
  GOLD: string; GOLD_DEEP: string
  ACCENT: string; CREAM: string
  BG_FROM: string; BG_TO: string
  BRAND: string
  /** 水色の円のうしろに敷く紙の色（円の縁のなじませに使う） */
  CIRCLE_BASE: string
}

const THEMES: Record<TeaCardVariant, CardTheme> = {
  normal: {
    INK: '#443528', INK_SOFT: '#7A6A55', INK_DEEP: '#332618',
    GOLD: '#C9A96E', GOLD_DEEP: '#A8873F',
    ACCENT: '#7E332A', CREAM: '#F6F0E4',
    BG_FROM: '#F8F3E8', BG_TO: '#EFE7D4',
    BRAND: '#A8760F',
    CIRCLE_BASE: '#F0E9DC',
  },
  collection: {
    INK: '#33304A', INK_SOFT: '#6A6785', INK_DEEP: '#26243A',
    GOLD: '#C9A96E', GOLD_DEEP: '#A8873F',
    ACCENT: '#3B3566', CREAM: '#E9EAF3',
    BG_FROM: '#EFEFF6', BG_TO: '#DFE1EE',
    BRAND: '#A8760F',
    CIRCLE_BASE: '#E4E5EF',
  },
}

/* 描画中だけ差し替える現在の配色。
   これまで const で書かれていた色名をそのまま使えるようにするため、
   let で持ち、generateTeaCard の先頭で適用している。
   カード生成は1枚ずつ順に行うため、途中で書き換わることはない。 */
let INK = THEMES.normal.INK           // 本文の焦げ茶（集めた版は紺鼠）
let INK_SOFT = THEMES.normal.INK_SOFT // 補助テキスト
let INK_DEEP = THEMES.normal.INK_DEEP // 見出し
let GOLD = THEMES.normal.GOLD         // 明るい琥珀
let GOLD_DEEP = THEMES.normal.GOLD_DEEP // 罫線・飾りの金
let ACCENT = THEMES.normal.ACCENT     // バッジの色
let CREAM = THEMES.normal.CREAM       // 背景の地色
let BRAND_COLOR = THEMES.normal.BRAND // ブランド名の金茶
let THEME: CardTheme = THEMES.normal

function applyTheme(v: TeaCardVariant) {
  const t = THEMES[v]
  THEME = t
  INK = t.INK; INK_SOFT = t.INK_SOFT; INK_DEEP = t.INK_DEEP
  GOLD = t.GOLD; GOLD_DEEP = t.GOLD_DEEP
  ACCENT = t.ACCENT; CREAM = t.CREAM
  BRAND_COLOR = t.BRAND
}

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

/** 幅に収まらない文字列を、末尾を省略して1行に収める */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1)
  return s ? s + '…' : ''
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
// 背景の飾り模様。public/card/pattern.png（ロゴ由来の模様）を薄く敷く。
// 画像が無い場合は何も描かず、カード生成は継続する。
async function drawDamask(ctx: CanvasRenderingContext2D) {
  const pat = await tryLoadImage('/card/pattern.png')
  if (!pat) return
  const ratio = pat.height / pat.width
  const place = (cx: number, cy: number, size: number, alpha: number) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(pat, cx - size / 2, cy - (size * ratio) / 2, size, size * ratio)
    ctx.restore()
  }
  // レーダーチャート（中心 745,525 付近）を避けて配置する。
  // 右上隅と香り分析の枠あたりを主役に、中央左は薄めに。
  place(W * 0.92, H * 0.61, 130, 0.30)   // 右側（香り分析の枠あたり）
  place(W * 0.93, H * 0.28, 105, 0.28)   // 右上隅
  place(W * 0.38, H * 0.52, 180, 0.14)   // 中央左（薄め・カップとレーダーの間）
}

// ── 水色の円（金の二重リング付き・枠内に収める構図） ──
function drawTeaCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hex: string) {
  const [rr, gg, bb, a] = parseHex(hex)
  const base = mix([rr, gg, bb], [248, 242, 230], 1 - a)
  const deep = mix(base, [30, 12, 4], 0.35)
  const edge = mix(base, [255, 238, 205], 0.5)

  // カップの白い縁の幅。実際のティーカップのように、金の縁と茶液の間に
  // 白磁の見切りを作る（茶液は縁より内側に収まる）。
  const rim = Math.round(r * 0.075)
  const rl = r - rim // 茶液の半径

  // 白磁のカップ（縁の部分として見える）
  const cupGrad = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, r * 0.6, cx, cy, r)
  cupGrad.addColorStop(0, '#FFFFFF')
  cupGrad.addColorStop(1, THEME.CIRCLE_BASE)
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = cupGrad; ctx.fill()

  // 液面
  const grad = ctx.createRadialGradient(cx - rl * 0.1, cy - rl * 0.15, rl * 0.05, cx, cy, rl)
  grad.addColorStop(0, rgbStr(deep))
  grad.addColorStop(0.5, rgbStr(mix(deep, base, 0.6)))
  grad.addColorStop(0.85, rgbStr(base))
  grad.addColorStop(1, rgbStr(edge))
  ctx.beginPath(); ctx.arc(cx, cy, rl, 0, Math.PI * 2)
  ctx.fillStyle = grad; ctx.fill()

  // 液面下部の照り返し
  const sheen = ctx.createRadialGradient(cx + rl * 0.25, cy + rl * 0.45, 0, cx + rl * 0.25, cy + rl * 0.45, rl * 0.6)
  sheen.addColorStop(0, 'rgba(255,225,170,0.35)')
  sheen.addColorStop(1, 'rgba(255,225,170,0)')
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, rl, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = sheen
  ctx.fillRect(cx - rl, cy - rl, rl * 2, rl * 2)
  ctx.restore()

  // 茶液のふち（白磁との境目に細い陰影を入れて液体の存在感を出す）
  ctx.beginPath(); ctx.arc(cx, cy, rl, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(120,80,40,0.28)'; ctx.lineWidth = 2; ctx.stroke()

  // 金の二重リング（カップの縁）
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = GOLD_DEEP; ctx.lineWidth = 4; ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'; ctx.lineWidth = 1.5; ctx.stroke()
}

// ── レーダーチャート ──
// レーダーの外周からラベル中心までの距離。チャートを大きくした分ここを詰めて、
// 右隣の枠囲みセクションとの間隔を確保している。
const RADAR_LABEL_GAP = 14

/** カードに載せるコメントの最大文字数。入力欄側の MAX_COMMENT と揃える。
    上限を下げる前に登録された長いコメントは、ここで切り詰めて表示する。 */
const CARD_MAX_COMMENT = 200

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
    const lx = cx + (radius + RADAR_LABEL_GAP) * Math.cos(a), ly = cy + (radius + RADAR_LABEL_GAP) * Math.sin(a)
    /* 上下（香り・水色）は横書きのまま。左右（コク・渋み）はアプリの
       レーダーチャート表示と合わせて、1文字ずつ縦に並べる。
       左右のラベルは占有幅が2文字→1文字に減るぶん、軸の見た目もすっきりする。 */
    const isSide = i === 1 || i === 3
    if (isSide) {
      const chars = labels[i].split('')
      const lineH = 24
      const startY = ly - ((chars.length - 1) * lineH) / 2
      chars.forEach((ch, ci) => ctx.fillText(ch, lx, startY + ci * lineH))
    } else {
      ctx.fillText(labels[i], lx, ly)
    }
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

// 画像の読み込みを試みる。存在しない（404等）場合はnullを返す＝呼び出し側で
// 従来の文字表示にフォールバックできる。DB登録不要でアイコンを差し込むための仕組み。
function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generateTeaCard(data: TeaCardData): Promise<Blob> {
  // 種類に応じた配色をこの1枚に適用する（既定は従来どおりの生成り）
  const variant: TeaCardVariant = data.variant ?? 'normal'
  applyTheme(variant)
  // フォント読み込みを待ってから描画（未ロードだと代替フォントで焼き付いてしまうため）
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── 背景（生成りグラデーション + ダマスク + 二重フレーム） ──
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, THEME.BG_FROM)
  bg.addColorStop(0.5, CREAM)
  bg.addColorStop(1, THEME.BG_TO)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  await drawDamask(ctx)

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
  // 左側（ブランド名・紅茶名・飾り罫・茶園名）とフッターは、
  // 通常の左端(64)より全角1文字分ぶん左に寄せる
  const leftShift = 20
  const nameX = 64 - leftShift
  let ny = cupCy + cupR + 40
  /* レーダーが左に寄ったぶん、左側の文字が伸びられる幅は狭くなった。
     レーダーの左ラベル（渋み）の手前で必ず止まるよう、上限をここで決める。
     LEFT_TEXT_MAX を1か所で管理し、ブランド名・紅茶名・茶園名すべてに使う。 */
  const LEFT_TEXT_MAX = 470
  if (data.brand_name) {
    const bf = fitFontSize(ctx, data.brand_name, 28, LEFT_TEXT_MAX, s => `italic 700 ${s}px ${SERIF}`)
    ctx.font = `italic 700 ${bf}px ${SERIF}`
    ctx.fillStyle = BRAND_COLOR
    ctx.fillText(data.brand_name, nameX, ny)
  }
  ny += 56
  const teaNameText = data.tea_name || '（お茶の名前）'
  const nf = fitFontSize(ctx, teaNameText, 52, LEFT_TEXT_MAX, s => `700 ${s}px ${MINCHO}`)
  ctx.font = `700 ${nf}px ${MINCHO}`
  ctx.fillStyle = INK_DEEP
  ctx.fillText(teaNameText, nameX, ny)
  // 茶園と原産国の表示。両方あれば「デジュー農園（インド）」、
  // 茶園が空なら括弧なしで「インド」だけを表示する。
  const gardenText = formatGardenOrigin(data.tea_garden, data.origin_country)
  if (gardenText) {
    // 飾り罫（金線）を挟んで茶園名。罫の長さは文字幅に合わせて可変にする
    const gf = fitFontSize(ctx, gardenText, 19, LEFT_TEXT_MAX, s => `400 ${s}px ${MINCHO}`, 13)
    ctx.font = `400 ${gf}px ${MINCHO}`
    const gw = ctx.measureText(gardenText).width

    ny += 22
    ctx.strokeStyle = 'rgba(168,135,63,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(nameX, ny); ctx.lineTo(nameX + gw, ny); ctx.stroke()

    ny += 26
    ctx.fillStyle = INK_SOFT
    ctx.fillText(gardenText, nameX, ny)
  }

  // ── 右上: TASTING CARD → 紅茶名 → 評価者/飲んだ日 → 場所 → 罫 → メモ ──
  // 右側の枠囲みセクションの左右位置。ヘッダー・コメント・区切り線の
  // 右端もこれに合わせるので、先に定義しておく。
  const boxX = 856
  const boxRight = W - 46
  const boxW = boxRight - boxX

  const rightX = 560
  const rightW = boxRight - rightX
  const indentX = rightX + 10   // Tea taster / at 行のインデント（半角スペース1個分程度）
  const drankDate = data.drank_at ? data.drank_at.slice(0, 10).replace(/-/g, '/') : ''

  // アイライン（小さな英字見出し）。飲んだ日は同じ行の右端に置く。
  // 集めたカードは見出しを COLLECTION に変え、そのすぐ右に集めた人の名前を添える。
  ctx.font = `700 20px ${SERIF}`
  ctx.fillStyle = GOLD_DEEP
  const headText = variant === 'collection'
    ? 'C O L L E C T I O N'
    : 'T A S T I N G   C A R D'
  ctx.fillText(headText, rightX, 64)
  if (variant === 'collection' && data.collected_by) {
    /* 見出しの実寸を測ってから続けて置く。
       名前が長いと日付に重なるため、余白に収まる分だけを表示する。 */
    const headW = ctx.measureText(headText).width
    const byX = rightX + headW + 18
    // 日付の手前で止める（日付がなければ右端まで使える）
    const limit = (drankDate ? W - 64 - 110 : W - 64) - byX
    ctx.font = `italic 400 18px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    ctx.fillText(ellipsize(ctx, `collected by ${data.collected_by}`, limit), byX, 64)
  }
  if (drankDate) {
    ctx.font = `italic 400 20px ${SERIF}`
    ctx.fillStyle = INK_SOFT
    ctx.textAlign = 'right'
    ctx.fillText(drankDate, W - 64, 64)
    ctx.textAlign = 'left'
  }

  let ty = 108
  const heading = data.tea_name || '（お茶の名前）'
  let headFont = 34
  for (const fs of [34, 32, 30, 28, 26, 24, 22, 20, 18]) {
    ctx.font = `700 ${fs}px ${MINCHO}`
    // 折り返さない（1行に収まる）最大サイズを選ぶ。
    // 紅茶名は20文字までなので、この範囲なら必ず1行に収まる。
    if (computeLines(ctx, heading, rightW, 99).length <= 1) { headFont = fs; break }
    headFont = fs
  }
  ctx.font = `700 ${headFont}px ${MINCHO}`
  ctx.fillStyle = INK_DEEP
  const headLh = Math.round(headFont * 1.4)
  const headLines = wrapText(ctx, heading, rightX, ty, rightW, headLh, 2)
  ty += (headLines - 1) * headLh + 30

  // 評価者と店名は同じ行に並べる。1行に収まらない場合だけ店名を次の行に送る
  const tasterText = data.user_name ? `Tea taster ${data.user_name}` : ''
  const shopText = data.shop_name ? `at ${data.shop_name}` : ''
  if (tasterText || shopText) {
    const availW = rightW - 10
    const oneLine = [tasterText, shopText].filter(Boolean).join('　　')
    ctx.font = `italic 400 20px ${SERIF}`
    if (ctx.measureText(oneLine).width <= availW) {
      ctx.fillStyle = INK_SOFT
      ctx.fillText(oneLine, indentX, ty)
      ty += 28
    } else {
      for (const line of [tasterText, shopText].filter(Boolean)) {
        const f = fitFontSize(ctx, line, 20, availW, s => `italic 400 ${s}px ${SERIF}`, 14)
        ctx.font = `italic 400 ${f}px ${SERIF}`
        ctx.fillStyle = INK_SOFT
        wrapText(ctx, line, indentX, ty, availW, f + 4, 1)
        ty += 28
      }
    }
  }
  // メモの前に細い罫線
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(rightX, ty - 8); ctx.lineTo(rightX + rightW, ty - 8); ctx.stroke()
  ty += 16

  // ── レーダー配置（先に決めて本文エリアの下限に使う） ──
  // コメントが上限（200字）まで書かれたときに本文と近づきすぎないよう、
  // 中心を少し下げている。右側のセクション（香り分析など）もこの座標を
  // 基準に配置されるため、一緒に下へ移動する。
  /* 枠囲みを2列×2段に組み替えて左へ広げたため、レーダーもその分だけ
     左・上に寄せ、半径を少し詰めている。（旧: 745 / H-195 / 120） */
  const radarCx = 700
  const radarCy = 556
  const radarR = 115
  // レーダーの一番下のラベル（水色）の下端。右側の枠囲みセクションは
  // 内容量で高さが変わるので、上からではなくこの線に下端を合わせて積む。
  const RADAR_LABEL_BOTTOM = radarCy + radarR + RADAR_LABEL_GAP + 11
  // コメントとレーダー・枠囲みエリアを分ける区切り線の位置。
  // 枠囲みの上端がこれより上に来ないよう boxTop で下限を決めている。
  const DIVIDER_Y = 364   // 200字のコメントが23pxで収まる限界に合わせた位置
  /* ノート風の薄い罫。複数行の項目（コメント・香り分析・淹れ方）の
     行間に引いて読みやすくする。文字のベースラインの少し下に置く。
     枠線より薄くして、罫が主張しすぎないようにしている。 */
  const drawRules = (
    x1: number, x2: number, firstBaseline: number, lineH: number, count: number, fontSize: number,
  ) => {
    if (count <= 0) return
    /* 罫は「その行の文字の下」に引く。
       ベースラインから下に出るのは descender（およそ文字サイズの22%）なので、
       そのすぐ下を狙う。ただし次の行の文字の上端
       （＝次のベースライン - 文字サイズの88%）を越えないよう上限を掛ける。
       行送りが詰まっているときは、両者の中間に逃がす。 */
    const below = fontSize * 0.22 + 3          // descender の下
    const nextTop = lineH - fontSize * 0.88    // 次の行の文字の上端
    const offset = below < nextTop ? below : Math.max(2, (below + nextTop) / 2)
    ctx.save()
    ctx.strokeStyle = 'rgba(168,135,63,0.22)'
    ctx.lineWidth = 1
    for (let i = 0; i < count; i++) {
      const y = Math.round(firstBaseline + i * lineH + offset) + 0.5
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
    }
    ctx.restore()
  }

  const boxTop = DIVIDER_Y + 16

  if (data.comment) {
    // コメントは最大200字。上限変更前に登録された長いコメントもここで切り、
    // 長さに応じて文字サイズを自動選択して必ず収める
    const commentText = data.comment.slice(0, CARD_MAX_COMMENT)
    const available = DIVIDER_Y - 8 - ty
    /* 大きい方から順に試し、行送りを詰めれば収まるならそのサイズを採用する。
       行間に罫を引くので、行送りの下限は文字サイズの1.42倍まで引き上げている。
       これより詰めると、罫と次の行の文字が触れてしまう。 */
    let chosen: [number, number] = [13, 19]
    for (let fs = 23; fs >= 13; fs--) {
      ctx.font = `400 ${fs}px ${MINCHO}`
      const lines = computeLines(ctx, commentText, rightW, 99)
      if (lines.length <= 1) { chosen = [fs, Math.round(fs * 1.55)]; break }
      // 最終行はベースラインより下に descender 分だけあればよい。
      // ここで文字サイズ1つ分を確保すると、1行分近い余白が下に残ってしまう。
      const fit = (available - fs * 0.3) / (lines.length - 1)
      if (fit >= fs * 1.42) { chosen = [fs, Math.floor(Math.min(fs * 1.55, fit))]; break }
    }
    const [fs, lh] = chosen
    ctx.font = `400 ${fs}px ${MINCHO}`
    ctx.fillStyle = INK
    // 上の判定と同じ数え方にしないと、収まるはずの行が「…」で切られてしまう
    const maxLines = Math.max(1, Math.floor((available - fs * 0.3) / lh) + 1)
    // 実際に描く行数だけ罫を引きたいので、先に行数を数えてから罫→文字の順に描く
    const drawnLines = Math.min(maxLines, computeLines(ctx, commentText, rightW, 99).length)
    drawRules(rightX, boxRight, ty, lh, drawnLines, fs)
    ctx.font = `400 ${fs}px ${MINCHO}`
    ctx.fillStyle = INK
    wrapText(ctx, commentText, rightX, ty, rightW, lh, maxLines)
  }

  // コメントとレーダー・枠囲みエリアの区切り線。右端は香り分析の枠と揃える
  ctx.strokeStyle = 'rgba(168,135,63,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(rightX, DIVIDER_Y)
  ctx.lineTo(boxRight, DIVIDER_Y)
  ctx.stroke()

  // ── 右下: レーダーチャート ──
  drawRadar(ctx, radarCx, radarCy, radarR,
    [data.score_aroma, data.score_richness, data.score_color_depth, data.score_astringency],
    ['香り', 'コク', '水色', '渋み'])

  // ── レーダーの右横: 香り分析 / 水色 / 淹れ方 / 添え物 ──
  // 位置と大きさは固定。未入力の項目があっても枠は詰めず、空のまま同じ場所に
  // 描く（カードごとに配置がずれると見比べにくいため）。
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const boxPad = 14
  // 上段（香り分析・水色）は枠が小さいので、左右の余白を詰めて文字幅を稼ぐ
  const topPad = 10
  const BODY_FS = 17
  const BODY_LH = 24
  const LEGEND_FS = 19   // 枠の見出し（香り分析・水色・添え物・淹れ方）
  const AROMA_FS = 20   // 香り分析は他より少し大きく見せる
  const AROMA_LH = 26

  /* 枠の配置は2列×2段。
       上段: 香り分析（広い） ＋ 水色（狭い）
       下段: 添え物（広い）   ＋ 淹れ方（狭い）
     以前は4つを縦に積んでいたが、添え物と淹れ方のアイコンを大きくするため、
     上段も横に並べて高さを空けている。
     左右の端は boxX と boxRight で決まり、内部の幅はそこから引き算で出すので、
     boxX を動かせば全体がそのまま追随する。 */
  const COL_GAP = 14        // 左右に並ぶ枠どうしの間隔
  const BOX_GAP = 16        // 上段と下段の間隔

  // 上段
  const AROMA_TOP = boxTop
  const TOP_H = 104         // 香りは最大3つ選べるので3行ぶんを確保する
  const COLOR_W = 182       // 「#RRGGBBAA」＋色見本と、10文字の色名が入る幅
  const AROMA_W = boxW - COL_GAP - COLOR_W
  const AROMA_X = boxX
  const COLOR_X = AROMA_X + AROMA_W + COL_GAP
  const COLOR_TOP = AROMA_TOP
  const COLOR_H = TOP_H

  // 下段
  const LOWER_TOP = AROMA_TOP + TOP_H + BOX_GAP
  const LOWER_BOTTOM = 716   // 右下の隅飾り(y=734の横線)と重ならない位置まで
  const LOWER_H = LOWER_BOTTOM - LOWER_TOP
  const BREW_W = 108
  const ACC_X = boxX
  const ACC_W = boxW - COL_GAP - BREW_W
  const BREW_X = ACC_X + ACC_W + COL_GAP

  /* マス（文字＋図）の寸法。淹れ方・添え物で共通。
     アイコンを大きく見せたいので、マスの高さと図の寸法を広げている。
     （旧: マス 57×69 / 図 43） */
  const CELL_W = 70
  const CELL_H = 88
  const CELL_GAP = 3
  const CELL_ICON = 58
  // マスの余白は上下左右すべて均等にする。縦は常に2行ぶんで計算するので、
  // 添え物が1行でも淹れ方のマスと高さが揃う。
  const CELL_ROWS = 2
  const CELL_TOP = (LOWER_H - CELL_ROWS * CELL_H) / (CELL_ROWS + 1)

  // 細い金罫の角丸枠。上辺の左寄りに切れ目を作り、そこに見出しを重ねる。
  // （背景がグラデーション＋模様なので、塗りつぶしで隠さず切れ目で抜く）
  const drawBox = (
    title: string, x: number, top: number, w: number, height: number,
    legendFs: number = LEGEND_FS,
  ) => {
    const r = 10
    ctx.font = `700 ${legendFs}px ${MINCHO}`
    const tw = ctx.measureText(title).width
    const gapStart = x + 12
    const gapEnd = gapStart + tw + 10
    ctx.strokeStyle = 'rgba(168,135,63,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gapEnd, top)
    ctx.lineTo(x + w - r, top)
    ctx.arcTo(x + w, top, x + w, top + r, r)
    ctx.lineTo(x + w, top + height - r)
    ctx.arcTo(x + w, top + height, x + w - r, top + height, r)
    ctx.lineTo(x + r, top + height)
    ctx.arcTo(x, top + height, x, top + height - r, r)
    ctx.lineTo(x, top + r)
    ctx.arcTo(x, top, x + r, top, r)
    ctx.lineTo(gapStart, top)
    ctx.stroke()
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText(title, gapStart + 5, top + legendFs / 2 - 2)
  }

  // 確保した正方形の中に画像を収める（縦横比は保ったまま中央寄せ）
  const putIcon = (img: HTMLImageElement, ox: number, oy: number, s: number) => {
    const k = Math.min(s / img.width, s / img.height)
    const w = img.width * k, h = img.height * k
    ctx.drawImage(img, ox + (s - w) / 2, oy + (s - h) / 2, w, h)
  }

  // 1マス分（上に文字・下に図）。図が未用意でも枠と文字は必ず描く
  // マス内の文字のベースライン。マスが高くなったぶん少し下げている
  const LABEL_BASE = 18
  const drawCell = (label: string, img: HTMLImageElement | null, x: number, y: number, w = CELL_W, dim = false) => {
    const r = 6
    ctx.strokeStyle = dim ? 'rgba(168,135,63,0.16)' : 'rgba(168,135,63,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.arcTo(x + w, y + CELL_H, x + w - r, y + CELL_H, r)
    ctx.arcTo(x, y + CELL_H, x, y + CELL_H - r, r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
    ctx.stroke()
    const lf = fitFontSize(ctx, label, 13, w - 10, s => `400 ${s}px ${MINCHO}`, 8)
    ctx.font = `400 ${lf}px ${MINCHO}`
    ctx.fillStyle = dim ? 'rgba(122,106,85,0.26)' : INK_SOFT
    ctx.textAlign = 'center'
    ctx.fillText(label, x + w / 2, y + LABEL_BASE)
    ctx.textAlign = 'left'
    /* 図はマスの残りの高さの中央に置く。マスの寸法を変えても、
       文字との間隔や下の余白が自動で釣り合うようにしている。 */
    if (img) {
      const areaTop = y + LABEL_BASE + 6
      const areaH = y + CELL_H - 6 - areaTop
      // 図はマスの幅からもはみ出さないようにする（淹れ方の横長マスにも対応）
      const size = Math.min(CELL_ICON, areaH, w - 14)
      ctx.save()
      if (dim) ctx.globalAlpha = 0.18
      putIcon(img, x + (w - size) / 2, areaTop + (areaH - size) / 2, size)
      ctx.restore()
    }
  }

  // 指定パスの画像をまとめて読み込む。欠けている分は null のまま返す
  const loadIcons = async (paths: (string | null)[]): Promise<(HTMLImageElement | null)[]> =>
    Promise.all(paths.map(p => (p ? tryLoadImage(p) : Promise.resolve(null))))

  // ── 香り分析 ──
  drawBox('香り分析', AROMA_X, AROMA_TOP, AROMA_W, TOP_H)
  // 常に3行分の枠として扱い、上から順に詰める。1つや2つのときに
  // 中央寄せにすると、カードごとに1行目の高さが変わって見比べにくいため。
  const TOP_FIRST_Y = AROMA_TOP + (TOP_H - (3 - 1) * AROMA_LH) / 2 + 8
  if (data.aroma_notes && data.aroma_notes.length) {
    const lines = data.aroma_notes.slice(0, 3).filter(Boolean)
    const innerW = AROMA_W - topPad * 2
    /* 香りは自由入力で10文字まで入る。枠を詰めたぶん、切り捨てるのではなく
       3つとも入る大きさまで一緒に縮める（1行だけ小さいと不揃いに見えるため）。 */
    // 箇条書きとして「・」を先頭に付ける（幅の判定も付けた状態で行う）
    const bullets = lines.map(l => `・${l}`)
    let af = AROMA_FS
    for (let sz = AROMA_FS; sz >= 12; sz--) {
      ctx.font = `400 ${sz}px ${MINCHO}`
      if (bullets.every(l => ctx.measureText(l).width <= innerW)) { af = sz; break }
      af = sz
    }
    // 行間にノート風の薄い罫を引く
    drawRules(AROMA_X + topPad, AROMA_X + AROMA_W - topPad, TOP_FIRST_Y, AROMA_LH, bullets.length, af)
    ctx.font = `400 ${af}px ${MINCHO}`
    ctx.fillStyle = INK
    bullets.forEach((l, i) => ctx.fillText(l, AROMA_X + topPad, TOP_FIRST_Y + i * AROMA_LH))
  }

  // ── 水色（パレット登録色なら色名、未登録なら「カスタム」＋色コードの小枠） ──
  drawBox('水色', COLOR_X, COLOR_TOP, COLOR_W, COLOR_H)
  if (data.color_hex) {
    const hexNorm = normalizeHex(data.color_hex)
    const innerW = COLOR_W - topPad * 2

    // 1行目: 色名。位置と大きさは香り分析の1行目に揃える
    const nameText = data.color_name || 'カスタム'
    const nameY = TOP_FIRST_Y
    const nf2 = fitFontSize(ctx, nameText, AROMA_FS, innerW, s => `400 ${s}px ${MINCHO}`, 12)
    ctx.font = `400 ${nf2}px ${MINCHO}`
    ctx.fillStyle = INK
    ctx.fillText(nameText, COLOR_X + topPad, nameY)

    /* 2行目以降: 色コードは「Color Code」の見出しを付けた小枠に入れる。
       色名が1行なので余る高さを、枠にすることで持たせている。
       小枠は水色の枠の内側に、下の余白を残して収める。 */
    const CC_X = COLOR_X + 8
    const CC_W = COLOR_W - 16
    const CC_TOP = nameY + 18
    const CC_H = COLOR_TOP + COLOR_H - 12 - CC_TOP
    drawBox('Color Code', CC_X, CC_TOP, CC_W, CC_H, 14)

    const SW = 20
    const ccPad = 10
    const hf = fitFontSize(ctx, hexNorm, 18, CC_W - ccPad * 2 - SW - 10, s => `400 ${s}px ${SERIF}`, 11)
    ctx.font = `400 ${hf}px ${SERIF}`
    ctx.fillStyle = INK
    // 小枠の中で上下中央に置く
    const hexY = CC_TOP + CC_H / 2 + hf / 2 - 1
    ctx.fillText(hexNorm, CC_X + ccPad, hexY)

    const swX = CC_X + ccPad + ctx.measureText(hexNorm).width + 10
    if (swX + SW <= CC_X + CC_W - ccPad) {
      const [sr, sg, sb, sa] = parseHex(hexNorm)
      const sbase = mix([sr, sg, sb], [248, 242, 230], 1 - sa)
      ctx.fillStyle = rgbStr(sbase)
      const swY = CC_TOP + (CC_H - SW) / 2
      ctx.fillRect(swX, swY, SW, SW)
      ctx.strokeStyle = GOLD_DEEP
      ctx.lineWidth = 1
      ctx.strokeRect(swX, swY, SW, SW)
    }
  }

  // ── 淹れ方（右列・1マス＋補足を「項目名＋値」で縦に並べる） ──
  // 文字列を分解すると旧形式（g/100ml）と区別できないため、データから直接組み立てる
  const brewRows: Array<{ label: string; value: string }> = []
  if (data.tea_grams != null) brewRows.push({ label: '茶葉量', value: `${data.tea_grams}g` })
  if (data.water_ml != null) brewRows.push({ label: '水量', value: `${data.water_ml}ml` })
  if (!brewRows.length && data.tea_grams_per_100ml != null) {
    brewRows.push({ label: '茶葉量', value: `${data.tea_grams_per_100ml}g/100ml` })
  }
  if (data.steep_seconds) brewRows.push({ label: '時間', value: `${data.steep_seconds}秒` })

  drawBox('淹れ方', BREW_X, LOWER_TOP, BREW_W, LOWER_H)
  if (data.brew_method || brewRows.length) {
    const [brewImg] = await loadIcons([data.brew_method ? brewIconPath(data.brew_method) : null])
    if (data.brew_method) {
      // 淹れ方は1つだけなので、マスを枠幅いっぱいの長方形にする
      drawCell(data.brew_method, brewImg, BREW_X + 8, LOWER_TOP + CELL_TOP, BREW_W - 16)
    }
    // 茶葉量・水量・時間がすべて未入力なら、空いた場所に飾り画像を置く
    if (!brewRows.length) {
      const [filler] = await loadIcons([BREW_FILLER_ICON])
      if (filler) {
        const areaTop = LOWER_TOP + CELL_TOP + CELL_H + 12
        const areaH = LOWER_TOP + LOWER_H - CELL_TOP - areaTop
        const size = Math.min(BREW_W - 24, areaH)
        putIcon(filler, BREW_X + (BREW_W - size) / 2, areaTop + (areaH - size) / 2, size)
      }
    }
    // 左に項目名（小さく）、右に値。値が長い場合は値だけ縮める
    const rowX = BREW_X + 8
    const rowRight = BREW_X + BREW_W - 8
    const rowW = rowRight - rowX
    const ROW_LH = 26
    let dy = LOWER_TOP + CELL_TOP + CELL_H + ROW_LH
    // 茶葉量・水量・時間の行間にも同じ罫を引く
    drawRules(rowX, rowRight, dy, ROW_LH, brewRows.length, 16)
    for (const row of brewRows) {
      // 項目名と値は同じ文字サイズ。両方入る最大サイズを選ぶ
      let rf = 16
      for (const cand of [16, 15, 14, 13, 12, 11, 10]) {
        ctx.font = `400 ${cand}px ${MINCHO}`
        if (ctx.measureText(row.label).width + 6 + ctx.measureText(row.value).width <= rowW) { rf = cand; break }
        rf = cand
      }
      ctx.font = `400 ${rf}px ${MINCHO}`
      ctx.fillStyle = INK_SOFT
      ctx.fillText(row.label, rowX, dy)
      ctx.fillStyle = INK
      ctx.textAlign = 'right'
      ctx.fillText(row.value, rowRight, dy)
      ctx.textAlign = 'left'
      dy += ROW_LH
    }
  }

  // ── 添え物（右列・マスを3つずつ折り返して並べる） ──
  // 添え物は選択肢6つを常に同じ位置に並べ、選ばれたものだけ濃く表示する。
  // （選んだものだけ描くとカードごとに位置が変わり、見比べにくいため）
  drawBox('添え物', ACC_X, LOWER_TOP, ACC_W, LOWER_H)
  {
    const selected = new Set(data.accompaniments ?? [])
    const accImgs = await loadIcons(ACCOMPANIMENT_ORDER.map(accompanimentIconPath))
    const perRow = Math.max(1, Math.floor((ACC_W - CELL_GAP) / (CELL_W + CELL_GAP)))
    // 余った幅を「左端・マスの間・右端」に均等配分する
    const gapX = (ACC_W - perRow * CELL_W) / (perRow + 1)
    ACCOMPANIMENT_ORDER.forEach((label, i) => {
      const cx = ACC_X + gapX + (i % perRow) * (CELL_W + gapX)
      const cy = LOWER_TOP + CELL_TOP + Math.floor(i / perRow) * (CELL_H + CELL_TOP)
      drawCell(accompanimentShortLabel(label), accImgs[i] ?? null, cx, cy, CELL_W, !selected.has(label))
    })
  }
  // ── 左下: フッター（上に細罫を敷く） ──
  const now = new Date()
  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
  // フッターのQRコード位置（罫線の長さもここに合わせる）
  const qrSize = 84
  ctx.font = `400 16px ${SERIF}`
  const footer = [
    '© 2026 My-Teas',
    `Generated: ${jst} JST`,
    'Website: https://my-teas.jp',
    'X: @myteas_kbk',
  ]
  // URLが短くなった分、文字の右端に合わせてQRコードを少し左へ寄せる
  // （固定オフセットのままだと、短くなった文字とQRの間に余白が空いてしまうため）
  const footerTextMaxW = Math.max(...footer.map(line => ctx.measureText(line).width))
  const qrGap = 28
  const qrX = nameX + footerTextMaxW + qrGap
  const footerRuleEnd = qrX + qrSize   // 罫線はQRコードの右端まで伸ばす

  ctx.strokeStyle = 'rgba(168,135,63,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(nameX, H - 132); ctx.lineTo(footerRuleEnd, H - 132); ctx.stroke()
  ctx.fillStyle = INK_SOFT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  // 印刷時につぶれて見えなくならないよう、行間も少し広げる
  footer.forEach((line, i) => ctx.fillText(line, nameX, H - 112 + i * 21))

  // フッター右のQRコード。public/card/qr.png を差し替えるだけで変更できる
  // （画像が無い場合は何も描画しないので、カード生成は失敗しない）
  const qr = await tryLoadImage('/card/qr.png')
  if (qr) {
    ctx.drawImage(qr, qrX, H - 132 + 6, qrSize, qrSize)
  }

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 0.95))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
