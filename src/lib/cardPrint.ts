// ─────────────────────────────────────────────────────────
// 評価カード（名刺サイズ）2枚を、ハガキサイズ1枚にまとめる
//
// 目的: コンビニのカラー印刷は名刺サイズを直接指定できないため、
//       ハガキ（100×148mm）に2枚並べて印刷し、後から切り取る。
//
// 寸法:
//   ハガキ    100 × 148 mm
//   評価カード 91 × 55 mm（名刺サイズ・比率 1274:770 と同じ）
//   → 縦に2枚並べても 55×2 = 110mm で収まる
// ─────────────────────────────────────────────────────────

const DPI = 350                       // 印刷用の解像度
const MM = (mm: number) => Math.round((mm / 25.4) * DPI)

export const POSTCARD_W_MM = 100
export const POSTCARD_H_MM = 148
export const CARD_W_MM = 91
export const CARD_H_MM = 55

/** 画像ファイルを読み込む */
function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('画像を開けませんでした'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

export interface PostcardOptions {
  /** 切り取り線を入れるか */
  cutGuide?: boolean
}

/**
 * カード画像1〜2枚を、ハガキサイズのPNGに配置して返す。
 * 1枚だけ渡した場合は上段に配置し、下段は空欄になる。
 */
export async function composePostcard(
  files: File[],
  options: PostcardOptions = {},
): Promise<Blob> {
  const { cutGuide = true } = options
  if (files.length === 0) throw new Error('画像を1枚以上選んでください')

  const images = await Promise.all(files.slice(0, 2).map(loadImageFile))

  const W = MM(POSTCARD_W_MM)
  const H = MM(POSTCARD_H_MM)
  const cw = MM(CARD_W_MM)
  const ch = MM(CARD_H_MM)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の生成に失敗しました')

  // 背景は白（印刷用なので透過にしない）
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // 左右中央に配置。上下は余白を均等に振り分ける
  const x = Math.round((W - cw) / 2)
  const gap = MM(8)                            // カード同士の間隔
  const totalH = ch * 2 + gap
  const topY = Math.round((H - totalH) / 2)
  const positions = [topY, topY + ch + gap]

  images.forEach((img, i) => {
    ctx.drawImage(img, x, positions[i], cw, ch)
  })

  if (cutGuide) {
    // 切り取りの目安線（薄いグレーの破線）。印刷後にカットする位置。
    ctx.strokeStyle = '#BBBBBB'
    ctx.lineWidth = Math.max(1, Math.round(DPI / 300))
    ctx.setLineDash([MM(2), MM(2)])
    positions.slice(0, Math.max(images.length, 1)).forEach(y => {
      ctx.strokeRect(x, y, cw, ch)
    })
    ctx.setLineDash([])
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/png',
    )
  })
}

/** 生成した画像をダウンロードする */
export function downloadPostcard(blob: Blob, filename = 'my-teas-postcard.png') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
