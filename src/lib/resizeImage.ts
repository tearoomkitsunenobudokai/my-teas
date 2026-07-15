// アバター画像をアップロード前にリサイズ・圧縮するユーティリティ。
// 大きな写真をそのまま保存すると容量を食うため、
// 最大 400x400px にリサイズし、JPEG品質0.8で圧縮した Blob を返す。

const MAX_SIZE = 400
const QUALITY = 0.8

export async function resizeImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像を開けませんでした'))
    image.src = dataUrl
  })

  // 正方形にトリミングしつつ、最大サイズに収める
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2
  const target = Math.min(side, MAX_SIZE)

  const canvas = document.createElement('canvas')
  canvas.width = target
  canvas.height = target
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像処理に失敗しました')
  ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/jpeg',
      QUALITY
    )
  })
}

// バナー画像用: アスペクト比を保ったまま、幅の上限のみでリサイズ（トリミングしない）
const BANNER_MAX_WIDTH = 1200

// ── 無断使用対策 ──────────────────────────────────────
// ① 表示に必要な最小限のサイズにしか圧縮しない（原寸データはアップロードしない）
// ② ごく薄いウォーターマークを自動で焼き込む
// のいずれもここに集約し、アップロード系の関数から呼び出す。

const WATERMARK_TEXT = '© My-Teas'

// canvasの右下に、デザインの邪魔にならない薄さでウォーターマークを描く
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fontSize = Math.max(10, Math.round(Math.min(w, h) * 0.045))
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  const pad = Math.round(fontSize * 0.6)
  // 縁取り（暗い背景・明るい背景どちらでも視認できるように）
  ctx.lineWidth = Math.max(1, fontSize * 0.12)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.strokeText(WATERMARK_TEXT, w - pad, h - pad)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(WATERMARK_TEXT, w - pad, h - pad)
}

// アイコン画像（抽出方法・添え物等、表示サイズが20px前後の小さい画像）用。
// 原寸を公開すると転用されやすいため、表示に必要な最小限のサイズに強制圧縮する。
const ICON_MAX_SIZE = 256

export async function resizeIconImage(file: File, watermark = true): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像を開けませんでした'))
    image.src = dataUrl
  })

  const scale = Math.min(1, ICON_MAX_SIZE / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像処理に失敗しました')
  ctx.drawImage(img, 0, 0, w, h)
  if (watermark) drawWatermark(ctx, w, h)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/png', // アイコンは背景透過を保持するためPNGのまま
    )
  })
}

export async function resizeImageKeepAspect(file: File, watermark = true): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像を開けませんでした'))
    image.src = dataUrl
  })

  const scale = Math.min(1, BANNER_MAX_WIDTH / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像処理に失敗しました')
  ctx.drawImage(img, 0, 0, w, h)
  if (watermark) drawWatermark(ctx, w, h)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/jpeg',
      QUALITY
    )
  })
}
