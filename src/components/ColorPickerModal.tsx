'use client'
/**
 * 写真から水色（お茶の色）を抽出するモーダル。
 *
 * ・カメラ撮影（スマホ）と、保存済み画像の選択の両方に対応する
 * ・画像の上に丸い「抽出枠」を表示し、その枠の中だけを平均して色を決める
 *   （1ピクセルだけを拾うと、光の反射やノイズで色がぶれるため）
 * ・枠はドラッグで移動、スライダーで大きさを変更できる
 * ・抽出時は極端に明るい／暗いピクセル（ハイライトや影）を除いてから平均する
 */
import { useEffect, useRef, useState } from 'react'
import TeaCup from './TeaCup'
import styles from './ColorPickerModal.module.css'

type Props = {
  /** 抽出した色を 8桁 hex（#RRGGBBAA）で返す。AA は「濃さ」スライダーの値 */
  onPick: (hex8: string) => void
  onClose: () => void
}

/** 濃さ(40〜100%) を 2桁の16進(不透明度)に変換する */
function alphaHex(density: number): string {
  return Math.round(Math.min(100, Math.max(0, density)) / 100 * 255)
    .toString(16).padStart(2, '0').toUpperCase()
}

/**
 * スライダー＋増減ボタンの行。
 * スマホではスライダーのつまみを細かく動かしづらいため、
 * 「≪ -10 / ‹ -1 / +1 › / +10 ≫」のボタンで確実に調整できるようにする。
 */
function StepperRow({ label, value, min, max, onChange, suffix }: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void; suffix?: string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className={styles.stepRow}>
      <div className={styles.stepHead}>
        <span className={styles.sizeLabel}>{label}</span>
        <span className={styles.stepVal}>{value}{suffix ?? ''}</span>
      </div>
      <div className={styles.stepCtrl}>
        <button type="button" className={styles.stepBtnLg}
          onClick={() => set(value - 10)} disabled={value <= min} aria-label={`${label}を10減らす`}>≪</button>
        <button type="button" className={styles.stepBtn}
          onClick={() => set(value - 1)} disabled={value <= min} aria-label={`${label}を1減らす`}>‹</button>
        <input type="range" min={min} max={max} value={value}
          onChange={e => set(Number(e.target.value))} className={styles.range}/>
        <button type="button" className={styles.stepBtn}
          onClick={() => set(value + 1)} disabled={value >= max} aria-label={`${label}を1増やす`}>›</button>
        <button type="button" className={styles.stepBtnLg}
          onClick={() => set(value + 10)} disabled={value >= max} aria-label={`${label}を10増やす`}>≫</button>
      </div>
    </div>
  )
}

export default function ColorPickerModal({ onPick, onClose }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const imgRef    = useRef<HTMLImageElement | null>(null)

  const [imgUrl, setImgUrl] = useState<string>('')
  // 抽出枠の位置（表示領域に対する 0〜1 の割合で保持し、画面サイズが変わってもずれないようにする）
  const [spot, setSpot] = useState({ x: 0.5, y: 0.5 })
  const [radius, setRadius] = useState(28)      // 抽出枠の半径（画面上のpx）
  const [hex, setHex] = useState('')
  const [dragging, setDragging] = useState(false)
  /* 濃さ（不透明度）。写真から取り込んだ色は「実際に見た色」なので既定は100%。
     撮影時の照明で濃く／薄く写った場合に、ここで微調整できるようにする。 */
  const [density, setDensity] = useState(100)

  // 画像を読み込んで canvas に描画する
  function loadFile(file?: File | null) {
    if (!file) return
    if (imgUrl) URL.revokeObjectURL(imgUrl)
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    setSpot({ x: 0.5, y: 0.5 })
    setHex('')
  }

  useEffect(() => {
    if (!imgUrl) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      draw()
      extract()
    }
    img.src = imgUrl
    return () => { imgRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl])

  // 枠が動いたら色を取り直す
  useEffect(() => {
    if (imgRef.current) extract()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot, radius])

  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl) }, [imgUrl])

  /** canvas に画像を実寸で描画（色の取得はこの canvas から行う） */
  function draw() {
    const img = imgRef.current, cv = canvasRef.current
    if (!img || !cv) return
    // 巨大な画像はそのまま扱うと重いので、長辺1000pxに縮小して描画する
    const max = 1000
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    cv.width  = Math.round(img.naturalWidth  * scale)
    cv.height = Math.round(img.naturalHeight * scale)
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, cv.width, cv.height)
  }

  /** 抽出枠の中の色を平均して hex を求める */
  function extract() {
    const cv = canvasRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // 表示上の枠の位置・大きさを、canvas 上の座標に変換する
    const rect = wrap.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const cx = Math.round(spot.x * cv.width)
    const cy = Math.round(spot.y * cv.height)
    const r  = Math.max(2, Math.round(radius * (cv.width / rect.width)))

    const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r)
    const w  = Math.min(cv.width  - x0, r * 2)
    const h  = Math.min(cv.height - y0, r * 2)
    if (w <= 0 || h <= 0) return

    let data: Uint8ClampedArray
    try {
      data = ctx.getImageData(x0, y0, w, h).data
    } catch {
      return
    }

    // 円の内側のみを対象にし、ハイライト（白飛び）と影（黒つぶれ）は除外する
    const picked: number[][] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x0 + x - cx, dy = y0 + y - cy
        if (dx * dx + dy * dy > r * r) continue
        const i = (y * w + x) * 4
        const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3]
        if (A < 200) continue
        const lum = 0.299 * R + 0.587 * G + 0.114 * B
        if (lum > 245 || lum < 12) continue   // 反射・影を除く
        picked.push([R, G, B])
      }
    }
    if (!picked.length) return

    // 外れ値の影響を抑えるため、明るさの中央付近60%だけを使って平均する
    picked.sort((a, b) =>
      (0.299*a[0]+0.587*a[1]+0.114*a[2]) - (0.299*b[0]+0.587*b[1]+0.114*b[2]))
    const s = Math.floor(picked.length * 0.2)
    const e = Math.ceil(picked.length * 0.8)
    const use = picked.slice(s, Math.max(s + 1, e))

    const sum = use.reduce((acc, c) => [acc[0]+c[0], acc[1]+c[1], acc[2]+c[2]], [0,0,0])
    const to2 = (v: number) => Math.round(v / use.length).toString(16).padStart(2, '0')
    setHex(`#${to2(sum[0])}${to2(sum[1])}${to2(sum[2])}`.toUpperCase())
  }

  /** 画像上をタップ／ドラッグして抽出位置を決める */
  function moveSpot(clientX: number, clientY: number) {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (clientY - rect.top)  / rect.height))
    setSpot({ x, y })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>📷 写真から水色を取り込む</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {!imgUrl ? (
          <div className={styles.pickArea}>
            <p className={styles.guide}>
              お茶を撮影するか、保存済みの写真を選んでください。<br/>
              白いカップに注いだ状態で、影や反射を避けて撮ると正確に取り込めます。
            </p>
            <div className={styles.pickBtns}>
              <button type="button" className={styles.bigBtn}
                onClick={() => cameraRef.current?.click()}>
                📷 カメラで撮影
              </button>
              <button type="button" className={styles.bigBtnAlt}
                onClick={() => fileRef.current?.click()}>
                🖼 画像を選択
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.editArea}>
            {/* 画像と抽出枠 */}
            <div ref={wrapRef} className={styles.imgWrap}
              onPointerDown={e => { setDragging(true); moveSpot(e.clientX, e.clientY) }}
              onPointerMove={e => { if (dragging) moveSpot(e.clientX, e.clientY) }}
              onPointerUp={() => setDragging(false)}
              onPointerLeave={() => setDragging(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="取り込んだ写真" className={styles.img} draggable={false}/>
              <span className={styles.spot}
                style={{
                  left: `${spot.x * 100}%`, top: `${spot.y * 100}%`,
                  width: radius * 2, height: radius * 2,
                }}/>
            </div>
            <p className={styles.guideSm}>枠をドラッグして、色を取りたい場所に合わせてください</p>

            <StepperRow label="枠の大きさ" value={radius} min={12} max={70}
              onChange={setRadius}/>

            {/* 濃さの調整（実際のカップ表示で確認しながら決められるようにする） */}
            <StepperRow label="濃さ" value={density} min={40} max={100}
              onChange={setDensity} suffix="%"/>

            {/* 抽出結果＋カップのプレビュー */}
            <div className={styles.resultRow}>
              <span className={styles.resultSwatch} style={{ background: hex || '#eee' }}/>
              <span className={styles.resultHex}>{hex || '—'}</span>
              <button type="button" className={styles.retakeBtn}
                onClick={() => { setImgUrl(''); setHex('') }}>
                撮り直す
              </button>
            </div>
            {hex && (
              <div className={styles.previewRow}>
                <TeaCup hex={hex + alphaHex(density)} size={72} tight/>
                <span className={styles.previewNote}>
                  登録するとこのように表示されます。<br/>
                  薄くすると柔らかい印象に、濃くすると写真に近づきます。
                </span>
              </div>
            )}

            <button type="button" className={styles.applyBtn} disabled={!hex}
              onClick={() => { if (hex) { onPick(hex + alphaHex(density)); onClose() } }}>
              この色を水色に設定する
            </button>
          </div>
        )}

        {/* 入力要素（非表示） */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files?.[0])}/>
        <input ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files?.[0])}/>
        <canvas ref={canvasRef} style={{ display: 'none' }}/>
      </div>
    </div>
  )
}
