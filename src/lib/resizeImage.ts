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
