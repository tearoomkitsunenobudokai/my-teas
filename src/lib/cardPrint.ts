// ─────────────────────────────────────────────────────────
// 評価カード（名刺サイズ）を、印刷しやすい用紙にまとめる
//
// 目的: コンビニのカラー印刷は名刺サイズを直接指定できないため、
//       ハガキやA4に並べて印刷し、後から切り取る。
//
// 寸法:
//   ハガキ    100 × 148 mm → 縦に2枚（55×2 = 110mm で収まる）
//   A4        210 × 297 mm → 横2列 × 縦4段の8枚
//   評価カード 91 × 55 mm（名刺サイズ・比率 1274:770 と同じ）
//
// A4に10枚（2列×5段）も計算上は入るが、
//   ・縦の余白が上下11mmずつしか残らず、フチが切れる機種で欠ける
//   ・切り取り線の外に入れるフッターの場所が確保できない
// ため、余白に余裕のある8枚を採用している。
//
// 解像度をA4だけ300dpiにしている理由:
//   350dpiだと 2894×4093px（約1185万画素）になり、
//   iOS Safari のcanvas上限（約1678万画素）に近づいて生成に失敗しやすい。
//   300dpiなら 2480×3508px（約870万画素）に収まり、印刷品質も十分。
// ─────────────────────────────────────────────────────────

export const CARD_W_MM = 91
export const CARD_H_MM = 55

/** 用紙の種類 */
export type PaperKind = 'postcard1' | 'postcard' | 'a4'

interface PaperSpec {
  /** ボタンに出す名前 */
  label: string
  /** 用紙そのものの呼び名（説明文で使う） */
  sizeLabel: string
  /** コンビニの印刷設定で選ぶ名前 */
  printName: string
  /** 用紙サイズ(mm) */
  wMM: number
  hMM: number
  /** カードの並び */
  cols: number
  rows: number
  /** カード同士の間隔(mm) */
  gapXMM: number
  gapYMM: number
  /** 印刷用の解像度 */
  dpi: number
  /** フッターの文字サイズ(mm) */
  footerMM: number
  /** 用紙を選んだときに出す説明 */
  hint: string
  /** 仕上がりの説明（切り取るのか、そのまま使うのか） */
  resultNote: string
  /** カード1枚の大きさ(mm)。省略時は名刺サイズ */
  cardWMM?: number
  cardHMM?: number
  /** 切り取り線を引くか。1枚を用紙いっぱいに使う場合は不要 */
  cutGuide?: boolean
}

export const PAPERS: Record<PaperKind, PaperSpec> = {
  postcard1: {
    label: 'ハガキ 1枚',
    sizeLabel: 'ハガキ（横）',
    printName: 'はがき',
    // 横向き
    wMM: 148, hMM: 100,
    cols: 1, rows: 1,
    gapXMM: 0, gapYMM: 0,
    dpi: 350,
    footerMM: 2.6,
    // 名刺サイズ(91×55)の比率を保ったまま、ハガキいっぱいまで拡大する
    cardWMM: 140, cardHMM: 140 * (CARD_H_MM / CARD_W_MM),
    cutGuide: false,
    hint: 'ハガキ1枚をまるごと使い、カードを大きく引き伸ばして印刷します。切り取らずにそのまま飾りたいときに向いています。',
    resultNote: '切り取らずに、そのまま1枚のカードとして使えます。',
  },
  postcard: {
    label: 'ハガキ 2枚',
    sizeLabel: 'ハガキ（縦）',
    printName: 'はがき',
    wMM: 100, hMM: 148,
    cols: 1, rows: 2,
    gapXMM: 0, gapYMM: 8,
    dpi: 350,
    footerMM: 2.6,
    hint: 'ハガキに縦2枚並べます。1〜2枚だけ印刷したいときに向いています。',
    resultNote: `線に沿って切り取ると名刺サイズ（${CARD_W_MM}×${CARD_H_MM}mm）のカードになります。`,
  },
  a4: {
    label: 'A4',
    sizeLabel: 'A4',
    printName: 'A4',
    wMM: 210, hMM: 297,
    cols: 2, rows: 4,
    gapXMM: 6, gapYMM: 8,
    dpi: 300,
    footerMM: 3.2,
    hint: 'A4は横2列×縦4段で8枚まとめられます。まとめて作って配りたいときに向いています。',
    resultNote: `線に沿って切り取ると名刺サイズ（${CARD_W_MM}×${CARD_H_MM}mm）のカードになります。`,
  },
}

/** 選べる用紙を、画面に並べたい順で返す */
export const PAPER_KINDS: PaperKind[] = ['postcard1', 'postcard', 'a4']

/** その用紙に何枚並べられるか */
export function paperCapacity(paper: PaperKind): number {
  const p = PAPERS[paper]
  return p.cols * p.rows
}

// 旧バージョンからの参照が残っていても壊れないよう、ハガキの寸法は名前付きでも公開する
export const POSTCARD_W_MM = PAPERS.postcard.wMM
export const POSTCARD_H_MM = PAPERS.postcard.hMM

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

export interface SheetOptions {
  /** 用紙の種類（既定はハガキ） */
  paper?: PaperKind
  /** 切り取り線を入れるか */
  cutGuide?: boolean
  /**
   * 枠ごとの切り出し位置（0〜1）。0=左/上端、0.5=中央、1=右/下端。
   * 評価カードは枠と同じ比率なので調整不要だが、
   * 自分で撮った写真は見せたい部分を選べるようにする。
   */
  focus?: ({ x: number; y: number; zoom?: number } | null)[]
}

/** 旧名（ハガキ専用だった頃のオプション名） */
export type PostcardOptions = SheetOptions

/**
 * カード画像を用紙サイズのPNGに配置して返す。
 * 配列の順番が、左上から右へ、そして次の段へ、という並び順になる。
 * null を渡したところは空欄になる。
 */
export async function composeSheet(
  files: (File | null)[],
  options: SheetOptions = {},
): Promise<Blob> {
  const { paper = 'postcard', cutGuide = true, focus = [] } = options
  const spec = PAPERS[paper]
  const capacity = spec.cols * spec.rows

  const slots = files.slice(0, capacity)
  if (!slots.some(Boolean)) throw new Error('画像を1枚以上選んでください')

  const mm = (v: number) => Math.round((v / 25.4) * spec.dpi)

  // null の枠は読み込まず、位置だけ確保する
  const images = await Promise.all(
    slots.map(f => (f ? loadImageFile(f) : Promise.resolve(null))),
  )

  const W = mm(spec.wMM)
  const H = mm(spec.hMM)
  const cw = mm(spec.cardWMM ?? CARD_W_MM)
  const ch = mm(spec.cardHMM ?? CARD_H_MM)
  const gapX = mm(spec.gapXMM)
  const gapY = mm(spec.gapYMM)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の生成に失敗しました')

  // 背景は白（印刷用なので透過にしない）
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // 全体を用紙の中央に置き、余白を上下左右に均等に振り分ける
  const totalW = cw * spec.cols + gapX * (spec.cols - 1)
  const totalH = ch * spec.rows + gapY * (spec.rows - 1)
  const leftX = Math.round((W - totalW) / 2)
  const topY = Math.round((H - totalH) / 2)

  /** i番目の枠の左上座標 */
  const slotPos = (i: number) => ({
    x: leftX + (i % spec.cols) * (cw + gapX),
    y: topY + Math.floor(i / spec.cols) * (ch + gapY),
  })

  images.forEach((img, i) => {
    if (!img) return
    const { x, y } = slotPos(i)
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
      /* 拡大するほど、元画像から切り出す範囲は狭くなる（＝寄って見える）。
         1未満は指定できないようにし、枠の外側が写り込まないようにする。 */
      const zoom = Math.max(1, focus[i]?.zoom ?? 1)
      sw = Math.max(1, Math.round(sw / zoom))
      sh = Math.max(1, Math.round(sh / zoom))
      // 既定は中央（0.5）。指定があればその位置を基準に切り出す。
      const fx = focus[i]?.x ?? 0.5
      const fy = focus[i]?.y ?? 0.5
      const sx = Math.round((img.naturalWidth  - sw) * Math.min(1, Math.max(0, fx)))
      const sy = Math.round((img.naturalHeight - sh) * Math.min(1, Math.max(0, fy)))
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cw, ch)
    }
  })

  if (cutGuide && spec.cutGuide !== false) {
    // 切り取りの目安線（薄いグレーの破線）。カードを置いた枠にだけ引く。
    ctx.strokeStyle = '#BBBBBB'
    ctx.lineWidth = Math.max(1, Math.round(spec.dpi / 300))
    ctx.setLineDash([mm(2), mm(2)])
    images.forEach((img, i) => {
      if (!img) return
      const { x, y } = slotPos(i)
      ctx.strokeRect(x, y, cw, ch)
    })
    ctx.setLineDash([])
  }

  /* 切り取り線の外側（余白部分）に、どこで作られたものかが分かる表記を入れる。
     カード自体には影響せず、切り取ると footer は残らない。 */
  drawFooter(ctx, W, H, topY + totalH, mm, spec.footerMM)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('画像の変換に失敗しました')),
      'image/png',
    )
  })
}

/**
 * ハガキサイズに2枚まとめる（従来の呼び出し方）。
 * 中身は composeSheet に委譲しているだけで、仕上がりは以前と同じ。
 */
export async function composePostcard(
  files: (File | null)[],
  options: Omit<SheetOptions, 'paper'> = {},
): Promise<Blob> {
  return composeSheet(files, { ...options, paper: 'postcard' })
}

/**
 * 切り取り枠の外に入れるフッター。
 * 用紙の下部余白に、サイト名とURLを控えめな文字で印字する。
 */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bottomOfCards: number,
  mm: (v: number) => number,
  footerMM: number,
) {
  const margin = mm(4)
  // 下の余白の中央に置く。余白が足りない場合は下端から一定の位置に置く。
  const available = H - bottomOfCards
  const y = available > mm(8)
    ? bottomOfCards + Math.round(available / 2)
    : H - margin

  ctx.save()
  ctx.fillStyle = '#9A9186'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const fs = Math.round(mm(footerMM))
  ctx.font = `${fs}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText('My-Teas  |  https://my-teas.jp', W / 2, y)
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

/** 生成した画像をダウンロードする（用紙名をファイル名に含める） */
export function downloadSheet(blob: Blob, paper: PaperKind) {
  const names: Record<PaperKind, string> = {
    postcard1: 'my-teas-postcard-1.png',
    postcard: 'my-teas-postcard.png',
    a4: 'my-teas-a4.png',
  }
  downloadPostcard(blob, names[paper])
}
