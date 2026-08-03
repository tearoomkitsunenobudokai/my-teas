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
 * カード画像をハガキサイズのPNGに配置して返す。
 * 配列の1番目が上段、2番目が下段。null を渡すとその段は空欄になる。
 */
export async function composePostcard(
  files: (File | null)[],
  options: PostcardOptions = {},
): Promise<Blob> {
  const { cutGuide = true } = options
  const slots = files.slice(0, 2)
  if (!slots.some(Boolean)) throw new Error('画像を1枚以上選んでください')

  // null の段は読み込まず、位置だけ確保する
  const images = await Promise.all(
    slots.map(f => (f ? loadImageFile(f) : Promise.resolve(null))),
  )

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
    if (!img) return
    const y = positions[i]
    const srcRatio = img.naturalWidth / img.naturalHeight
    const dstRatio = cw / ch
    if (Math.abs(srcRatio - dstRatio) < 0.01) {
      // 評価カードのように比率が同じものは、そのまま枠いっぱいに描く
      ctx.drawImage(img, x, y, cw, ch)
    } else {
      /* 自分で撮った写真は縦横比がまちまちなので、枠に合わせて引き伸ばすと
         人物や器が歪んでしまう。比率を保ったまま中央部分を切り出して収める。 */
      let sw = img.naturalWidth
      let sh = img.naturalHeight
      if (srcRatio > dstRatio) {
        // 横長すぎる → 左右を切り落とす
        sw = Math.round(img.naturalHeight * dstRatio)
      } else {
        // 縦長すぎる → 上下を切り落とす
        sh = Math.round(img.naturalWidth / dstRatio)
      }
      const sx = Math.round((img.naturalWidth - sw) / 2)
      const sy = Math.round((img.naturalHeight - sh) / 2)
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cw, ch)
    }
  })

  if (cutGuide) {
    // 切り取りの目安線（薄いグレーの破線）。カードを置いた段にだけ引く。
    ctx.strokeStyle = '#BBBBBB'
    ctx.lineWidth = Math.max(1, Math.round(DPI / 300))
    ctx.setLineDash([MM(2), MM(2)])
    images.forEach((img, i) => {
      if (img) ctx.strokeRect(x, positions[i], cw, ch)
    })
    ctx.setLineDash([])
  }

  /* 切り取り線の外側（余白部分）に、どこで作られたものかが分かる表記を入れる。
     カード自体には影響せず、切り取ると footer は残らない。 */
  drawFooter(ctx, W, H, topY + ch * 2 + gap)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/png',
    )
  })
}

/**
 * 切り取り枠の外に入れるフッター。
 * ハガキの下部余白に、サイト名とURLを控えめな文字で印字する。
 */
function drawFooter(ctx: CanvasRenderingContext2D, W: number, H: number, bottomOfCards: number) {
  const margin = MM(4)
  // 下の余白の中央に置く。余白が足りない場合は下端から一定の位置に置く。
  const available = H - bottomOfCards
  const y = available > MM(8)
    ? bottomOfCards + Math.round(available / 2)
    : H - margin

  ctx.save()
  ctx.fillStyle = '#9A9186'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const fs = Math.round(MM(2.6))
  ctx.font = `${fs}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText('My-Teas  |  https://my-teas-omega.vercel.app', W / 2, y)
  ctx.restore()
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
