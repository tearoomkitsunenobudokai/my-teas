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
import { createClient } from '@/lib/supabase'
import { isTextClean } from '@/lib/moderation'
import { MAX_COLOR_NAME, detectCategory, findDuplicateColor } from '@/lib/colorPalette'
import styles from './ColorPickerModal.module.css'

type Props = {
  /** 抽出した色を 8桁 hex（#RRGGBBAA）で返す。AA は「濃さ」スライダーの値 */
  onPick: (hex8: string, name?: string) => void
  /** 自分の色として登録したときに呼ばれる（親側で色一覧を読み直すため） */
  onRegistered?: () => void
  /** カラーパレット画面から使う場合など、登録欄を出さずに色だけ返したいときに true */
  pickOnly?: boolean
  onClose: () => void
}

/**
 * 濃さを反映した「登録後の色」を求める。
 * カップは白磁の地色（#F8F2E6）に色を重ねて描いているため、
 * 同じ計算で合成した色を比較用の半円に使う。
 */
function blendedHex(hex6: string, density: number): string {
  const h = hex6.replace('#', '')
  if (h.length < 6) return hex6
  const a = Math.min(100, Math.max(0, density)) / 100
  const base = [248, 242, 230]
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16)
    return Math.round(v * a + base[i / 2] * (1 - a))
  })
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
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

export default function ColorPickerModal({ onPick, onRegistered, pickOnly = false, onClose }: Props) {
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
  /* 画像の拡大率。カップだけを大きく写して、抽出位置を合わせやすくする。
     拡大の中心は抽出枠（spot）に合わせるので、枠を動かせば見たい場所が中央に来る。 */
  const [zoom, setZoom] = useState(1)
  /* 「自分の色として登録する」関連。
     登録しておくと、評価カードで「カスタム」ではなく色名が表示される。 */
  const [saveAsMine, setSaveAsMine] = useState(false)
  const [colorName, setColorName]   = useState('')
  const [nameErr, setNameErr]       = useState('')
  const [myCount, setMyCount]       = useState<number | null>(null)  // 登録済みの個人色の数
  /* 登録上限。管理者メニューで権限区分ごとに変更できるため、固定値ではなく
     plan_limits から取得する。0 は「無制限」を表す。 */
  const [maxColors, setMaxColors]   = useState<number | null>(null)
  /* 登録済みの色（重複チェック用）。抽出した時点で気づけるようにする。 */
  const [myPalette, setMyPalette]   = useState<{id:string;name:string;hex:string}[]>([])
  /* 抽出枠の中を切り抜いた画像（比較図の左半分に使う）。
     平らな色ではなく実際の写真なので、光沢や粒子の見え方まで比べられる。 */
  const [cropUrl, setCropUrl]       = useState('')
  const [saving, setSaving]         = useState(false)
  const supabase = createClient()
  /* 上限に達しているか。maxColors が 0 の場合は無制限なので常に false。 */
  const atLimit = myCount !== null && maxColors !== null && maxColors > 0 && myCount >= maxColors
  /* 抽出中の色が、すでに登録済みの色と同じかどうか（透明度の違いは無視） */
  const dupColor = hex ? findDuplicateColor(myPalette, hex) : undefined

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
  }, [spot, radius, zoom])

  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl) }, [imgUrl])

  /* 登録済みの個人色の数を先に取得しておく。
     上限に達している場合は、登録のチェックボックス自体を使えないようにする。 */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ count }, { data: limitVal }, { data: palette }] = await Promise.all([
        supabase.from('tea_colors')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id).eq('is_official', false),
        supabase.rpc('get_my_limit', { p_feature: 'colors' }),
        supabase.from('tea_colors').select('id,name,hex,is_official,created_by'),
      ])
      if (!alive) return
      setMyCount(count ?? 0)
      setMaxColors(typeof limitVal === 'number' ? limitVal : 0)
      setMyPalette((palette ?? []).filter(c => c.is_official || c.created_by === user.id))
    })()
    return () => { alive = false }
  }, [])

  /** 「自分の色」として登録する。成功したら true を返す */
  async function registerColor(hex8: string): Promise<boolean> {
    const name = colorName.trim()
    if (!name) { setNameErr('色の名前を入力してください'); return false }

    // 他の入力項目と同じ基準で、不適切な語が含まれていないか確認する
    const check = isTextClean(name)
    if (!check.clean) {
      setNameErr(check.reason ?? '入力できない語が含まれています')
      return false
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNameErr('ログイン情報が取得できませんでした'); return false }

    // 保存の直前にも上限を確認する（別の画面で追加された場合に備える）
    const [{ count }, { data: limitVal }] = await Promise.all([
      supabase.from('tea_colors')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id).eq('is_official', false),
      supabase.rpc('get_my_limit', { p_feature: 'colors' }),
    ])
    const now = count ?? 0
    const max = typeof limitVal === 'number' ? limitVal : 0
    setMyCount(now); setMaxColors(max)
    // max が 0 のときは無制限
    if (max > 0 && now >= max) {
      setNameErr(`登録できる色は${max}色までです。カラーパレット画面で不要な色を削除してください。`)
      return false
    }

    /* すでに同じ色が登録されていないか確認する（透明度の違いは同色として扱う）。
       公式の色と自分の色が対象。 */
    const { data: existing } = await supabase.from('tea_colors')
      .select('id,name,hex,is_official,created_by')
    const visible = (existing ?? []).filter(c => c.is_official || c.created_by === user.id)
    const dup = findDuplicateColor(visible, hex8)
    if (dup) {
      setNameErr(`この色はすでに「${dup.name}」として登録されています。登録のチェックを外すか、別の色をお選びください。`)
      return false
    }

    const { error } = await supabase.from('tea_colors').insert({
      name,
      hex: hex8,
      category: detectCategory(hex8.slice(0, 7)),  // 色から自動で分類する
      is_official: false,
      created_by: user.id,
    })
    if (error) { setNameErr('登録に失敗しました。時間をおいて試してください。'); return false }
    setMyCount(now + 1)
    return true
  }

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
    // 画面上の枠の半径を、canvas 上の半径に変換する。
    // 拡大表示中は画像が引き伸ばされているぶん、対象になる範囲は狭くなる。
    const r  = Math.max(2, Math.round(radius * (cv.width / rect.width) / zoom))

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

    /* 比較図に使うため、枠の中身をそのまま切り抜いた画像も作っておく。
       小さすぎると粗く見えるので、一定の大きさに拡大して書き出す。 */
    try {
      const out = document.createElement('canvas')
      const size = 256
      out.width = size
      out.height = size
      const octx = out.getContext('2d')
      if (octx) {
        octx.imageSmoothingQuality = 'high'
        octx.drawImage(cv, x0, y0, w, h, 0, 0, size, size)
        setCropUrl(out.toDataURL('image/png'))
      }
    } catch {
      // 切り抜きに失敗しても、色の抽出自体には影響させない
    }
  }

  /** 画像上をタップ／ドラッグして抽出位置を決める */
  function moveSpot(clientX: number, clientY: number) {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    // 表示上の位置（0〜1）
    const px = (clientX - rect.left) / rect.width
    const py = (clientY - rect.top)  / rect.height
    // 拡大の中心は現在の抽出枠なので、そこを基準に画像上の位置へ戻す
    //   表示位置 = 中心 + (画像上の位置 - 中心) × 拡大率
    //   → 画像上の位置 = 中心 + (表示位置 - 中心) ÷ 拡大率
    const fx = spot.x + (px - spot.x) / zoom
    const fy = spot.y + (py - spot.y) / zoom
    setSpot({
      x: Math.min(1, Math.max(0, fx)),
      y: Math.min(1, Math.max(0, fy)),
    })
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
              <img src={imgUrl} alt="取り込んだ写真" className={styles.img} draggable={false}
                style={{
                  transform: `scale(${zoom})`,
                  // 抽出枠の位置を拡大の中心にすることで、枠が画面外へ逃げないようにする
                  transformOrigin: `${spot.x * 100}% ${spot.y * 100}%`,
                }}/>
              <span className={styles.spot}
                style={{
                  left: `${spot.x * 100}%`, top: `${spot.y * 100}%`,
                  width: radius * 2, height: radius * 2,
                }}/>
            </div>
            <p className={styles.guideSm}>枠をドラッグして、色を取りたい場所に合わせてください</p>

            {/* 取り込んだ写真は周囲が写り込んでいるため、拡大してカップに寄れるようにする */}
            <StepperRow label="拡大" value={Math.round(zoom * 100)} min={100} max={400}
              onChange={v => setZoom(v / 100)} suffix="%"/>

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
              <div className={styles.compareWrap}>
                {/* 左：同じ部位（液面の中心）どうしの比較。
                    カップは縁が明るく抜ける設計なので、拡大して中心付近だけを見せる。
                    外周のリングは抽出した色そのもので、3つを同時に見比べられる。 */}
                <div className={styles.compareMain}>
                  <span className={styles.compareRing} style={{ background: hex }}>
                    <span className={styles.splitCircle}>
                      <span className={styles.splitHalfImg}
                        style={{ backgroundImage: cropUrl ? `url(${cropUrl})` : undefined }}/>
                      <span className={styles.splitHalfCup}>
                        <span className={styles.splitCupInner}>
                          <TeaCup hex={hex + alphaHex(density)} tight/>
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className={styles.compareLabel}>中心どうしの比較</span>
                  <span className={styles.compareSub}>外周：抽出色／左：写真／右：カップ</span>
                </div>

                {/* 右：色そのものと、カップ全体の見え方を縦に並べる */}
                <div className={styles.compareSide}>
                  <div className={styles.compareItemSm}>
                    <span className={styles.rawCircleSm} style={{ background: hex }}/>
                    <span className={styles.compareLabel}>写真の色</span>
                  </div>
                  <div className={styles.compareItemSm}>
                    <TeaCup hex={hex + alphaHex(density)} size={72} tight/>
                    <span className={styles.compareLabel}>登録後の表示</span>
                  </div>
                </div>
              </div>
            )}
            {hex && (
              <p className={styles.previewNote}>
                左右を見比べて濃さを調整してください。薄くすると柔らかい印象に、濃くすると写真に近づきます。
              </p>
            )}

            {/* 自分の色として登録（評価カードで色名が表示されるようになる）
                pickOnly のときは、呼び出し元の画面側で登録するため表示しない */}
            {hex && !pickOnly && (
              <div className={styles.registerBox}>
                <p className={styles.label}>🏷 この色の名前</p>
                <input className={styles.nameInput} value={colorName} maxLength={MAX_COLOR_NAME}
                  onChange={e => { setColorName(e.target.value.slice(0, MAX_COLOR_NAME)); setNameErr('') }}
                  placeholder={`例: 琥珀色（未入力だとカードに「カスタム」と表示されます）`}/>

                <label className={styles.registerCheck}>
                  <input type="checkbox" checked={saveAsMine}
                    disabled={atLimit || !colorName.trim() || !!dupColor}
                    onChange={e => { setSaveAsMine(e.target.checked); setNameErr('') }}/>
                  <span>この色をカラーパレットにも登録する</span>
                </label>
                <p className={styles.registerHint}>
                  名前を付けるだけで、この評価のカードには色名が表示されます。
                  パレットに登録すると、次回以降そこから選べるようになります。
                  {myCount !== null && (
                    <span className={styles.registerCount}>
                      （登録済み {myCount}{maxColors ? ` / ${maxColors}` : '（上限なし）'}）
                    </span>
                  )}
                </p>
                {dupColor && (
                  <p className={styles.registerErr}>
                    この色はすでに「{dupColor.name}」として登録されています。
                    パレットへの登録はできませんが、この評価の色としてはそのまま使えます。
                  </p>
                )}
                {atLimit && (
                  <p className={styles.registerErr}>
                    登録できる色が上限（{maxColors}色）に達しています。
                    カラーパレット画面で不要な色を削除すると登録できます。
                  </p>
                )}
                {nameErr && <p className={styles.registerErr}>{nameErr}</p>}
              </div>
            )}

            <button type="button" className={styles.applyBtn} disabled={!hex || saving}
              onClick={async () => {
                if (!hex) return
                const hex8 = hex + alphaHex(density)
                const name = colorName.trim()
                // 名前を付けた場合は、パレットに登録しなくても不適切語の確認を行う
                if (name) {
                  const check = isTextClean(name)
                  if (!check.clean) {
                    setNameErr(check.reason ?? '入力できない語が含まれています')
                    return
                  }
                }
                if (saveAsMine) {
                  setSaving(true)
                  const ok = await registerColor(hex8)
                  setSaving(false)
                  if (!ok) return   // 名前の不備や上限超過のときは閉じない
                  onRegistered?.()  // 親の色一覧を更新し、色名が反映されるようにする
                }
                onPick(hex8, name || undefined)
                onClose()
              }}>
              {saving ? '登録しています…'
                : saveAsMine ? 'パレットに登録して水色に設定する' : 'この色を水色に設定する'}
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
