'use client'
/**
 * 印刷用の切り取り位置を、ドラッグとピンチで直感的に合わせるためのプレビュー。
 *
 * ・枠は仕上がりと同じ 91:55
 * ・1本指のドラッグ … 位置の移動
 * ・2本指のピンチ  … 拡大・縮小（マウスではホイール）
 * ・位置と倍率は 0〜1 の割合で持ち、そのまま印刷側の切り出しに使う
 */
import { useRef, useState, useEffect } from 'react'
import styles from './CropPreview.module.css'

export interface CropValue { x: number; y: number; zoom: number }

export default function CropPreview({
  src, value, onChange, disabled = false,
}: {
  src: string
  value: CropValue
  onChange: (v: CropValue) => void
  /** 位置を固定しているとき（評価カード）は操作させず、全体をそのまま表示する */
  disabled?: boolean
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  // 操作中の指の情報
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
  const clampZoom = (v: number) => Math.min(4, Math.max(1, v))

  /** 表示上の1pxが、位置の割合でどれだけに相当するかを求める */
  function ratioPerPx() {
    const frame = frameRef.current
    if (!frame || !natural.w || !natural.h) return { rx: 0, ry: 0 }
    const fw = frame.clientWidth, fh = frame.clientHeight
    const srcRatio = natural.w / natural.h
    const dstRatio = fw / fh
    // 切り出しに使える「余り」の量（これが移動できる幅になる）
    let spareW = 0, spareH = 0
    if (srcRatio > dstRatio) {
      const usedW = natural.h * dstRatio / value.zoom
      spareW = natural.w - usedW
      spareH = natural.h - natural.h / value.zoom
    } else {
      const usedH = natural.w / dstRatio / value.zoom
      spareH = natural.h - usedH
      spareW = natural.w - natural.w / value.zoom
    }
    // 画面上のpx移動量 → 元画像のpx → 割合
    const scale = srcRatio > dstRatio ? fh / (natural.h / value.zoom) : fw / (natural.w / value.zoom)
    return {
      rx: spareW > 0 ? 1 / (spareW * scale) : 0,
      ry: spareH > 0 ? 1 / (spareH * scale) : 0,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, fx: value.x, fy: value.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (disabled || !drag.current) return
    const { rx, ry } = ratioPerPx()
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    // 指の動きと画像の動きを一致させるため、移動方向は反転させる
    onChange({
      ...value,
      x: clamp01(drag.current.fx - dx * rx),
      y: clamp01(drag.current.fy - dy * ry),
    })
  }

  function onPointerUp() { drag.current = null }

  /* ピンチ操作。2本指の間隔の変化を倍率に反映する。 */
  function onTouchStart(e: React.TouchEvent) {
    if (disabled || e.touches.length !== 2) return
    drag.current = null
    const d = touchDist(e.touches)
    pinch.current = { dist: d, zoom: value.zoom }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (disabled || e.touches.length !== 2 || !pinch.current) return
    e.preventDefault()
    const d = touchDist(e.touches)
    const z = clampZoom(pinch.current.zoom * (d / pinch.current.dist))
    onChange({ ...value, zoom: z })
  }
  function onTouchEnd() { pinch.current = null }

  /** マウス操作のときはホイールで拡大縮小できるようにする */
  function onWheel(e: React.WheelEvent) {
    if (disabled) return
    const z = clampZoom(value.zoom * (e.deltaY < 0 ? 1.06 : 0.94))
    onChange({ ...value, zoom: z })
  }

  return (
    <div
      ref={frameRef}
      className={`${styles.frame} ${disabled ? '' : styles.frameActive}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="印刷プレビュー" className={styles.img} draggable={false}
        style={disabled
          // 位置固定（評価カード）のときは、枠にそのまま合わせる
          ? { objectFit: 'fill', objectPosition: 'center' }
          : {
              objectFit: 'cover',
              objectPosition: `${value.x * 100}% ${value.y * 100}%`,
              transform: `scale(${value.zoom})`,
              transformOrigin: `${value.x * 100}% ${value.y * 100}%`,
            }}/>
      {!disabled && <span className={styles.hint}>ドラッグで移動 / ピンチで拡大縮小</span>}
    </div>
  )
}

function touchDist(t: React.TouchList | TouchList) {
  const dx = t[0].clientX - t[1].clientX
  const dy = t[0].clientY - t[1].clientY
  return Math.hypot(dx, dy)
}
