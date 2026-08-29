'use client'

import { useEffect, useState, useCallback } from 'react'
import CropPreview from './CropPreview'
import { createClient } from '@/lib/supabase'
import { generateTeaCard } from '@/lib/teaCard'
import {
  composeSheet, downloadSheet, PAPERS, PAPER_KINDS, paperCapacity,
  // 寸法の表記は用紙定義側の resultNote に集約したため、ここでは使わない
  type PaperKind,
} from '@/lib/cardPrint'
import styles from './card-print.module.css'

/* 用紙のうち一番多く並べられる枚数。
   状態は常にこの数だけ持っておき、用紙を切り替えても選んだ画像が消えないようにする。 */
const MAX_SLOTS = Math.max(...PAPER_KINDS.map(paperCapacity))

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧']

type Focus = { x: number; y: number; zoom: number }
const DEFAULT_FOCUS: Focus = { x: 0.5, y: 0.5, zoom: 1 }

export default function CardPrintPage() {
  const supabase = createClient()

  // 消費ポイントはDB（feature_costs）から取得する。
  // 開発中は0のため無料。有料化は管理画面「💎 ポイント設定」から変更できる。
  const [cost, setCost] = useState(0)
  const [points, setPoints] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [paper, setPaper] = useState<PaperKind>('postcard')
  const capacity = paperCapacity(paper)
  const spec = PAPERS[paper]

  /* 枠ごとの状態は配列で持つ。
     A4は8枠あるため、ハガキ時代の slot1/slot2 のような個別の変数では足りない。 */
  const [files,    setFiles]    = useState<(File | null)[]>(() => Array(MAX_SLOTS).fill(null))
  const [previews, setPreviews] = useState<string[]>(() => Array(MAX_SLOTS).fill(''))
  /* 「位置を固定」設定と、切り出し位置（0〜1）。
     評価カードは枠と同じ比率なので位置調整は不要。既定は固定（中央）にしておき、
     写真を入れたいときだけチェックを外して調整できるようにする。 */
  const [locks,    setLocks]    = useState<boolean[]>(() => Array(MAX_SLOTS).fill(true))
  const [focuses,  setFocuses]  = useState<Focus[]>(() => Array(MAX_SLOTS).fill(DEFAULT_FOCUS))

  /* 集めたカードから直接入れるための状態。
     カード画像は保存していないので、選ばれたぶんだけその場で作って枠に入れる。 */
  const [myName, setMyName] = useState('')
  const [collected, setCollected] = useState<any[]>([])
  const [collectAvailable, setCollectAvailable] = useState(false)
  const [myReviews, setMyReviews] = useState<any[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // 選ぶ元（自分の評価 / 集めたカード）と、絞り込みの文字
  const [pickSrc, setPickSrc] = useState<'mine' | 'collected'>('mine')
  const [pickQuery, setPickQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [building, setBuilding] = useState(0)   // 生成中の枚数（0なら生成していない）

  const [cutGuide, setCutGuide] = useState(true)
  const [working, setWorking] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const load = useCallback(async () => {
    /* 並列のクエリを投げる前に getUser() を1回だけ待つ。
       getSession() はローカルの値を返すだけなので、期限切れのトークンのまま
       複数のリクエストが同時に更新を試み、先に成功した1本以外が失敗して
       セッションごと破棄される（＝ログアウトされる）ことがあるため。 */
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data: c }, { data: profile }] = await Promise.all([
      supabase.rpc('get_feature_cost', { p_feature: 'card_print' }),
      supabase.from('profiles').select('is_admin,is_creator,points').eq('id', user.id).single(),
    ])
    if (typeof c === 'number') setCost(c)
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)

    /* カードにできるもとの一覧。
       自分の評価と、集めたカードの両方から選べるようにする。
       集めたカードは、マイグレーション未実行の環境では取得に失敗するので隠す。 */
    const MINE_COLS = 'id,tea_name,brand_name,shop_name,tea_garden,origin_country,color_hex,color_name,aroma_notes,comment,drank_at,brew_method,steep_seconds,tea_grams_per_100ml,tea_grams,water_ml,accompaniments,score_aroma,score_astringency,score_richness,score_color_depth'
    const [{ data: cards, error: cardsErr }, { data: me }, { data: mine }] = await Promise.all([
      supabase.from('my_collected_cards').select('*').order('collected_at', { ascending: false }),
      supabase.from('profiles').select('name').eq('id', user.id).single(),
      supabase.from('reviews').select(MINE_COLS)
        .eq('user_id', user.id).order('drank_at', { ascending: false }).limit(200),
    ])
    setCollectAvailable(!cardsErr)
    setCollected(cards ?? [])
    setMyReviews(mine ?? [])
    setMyName(me?.name ?? '')
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // 画面を離れるときにプレビュー用のURLを開放する
  useEffect(() => {
    return () => { previews.forEach(u => { if (u) URL.revokeObjectURL(u) }) }
    // 開放は画面を閉じるときの1回だけでよいため、依存は空にしている
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 用紙を切り替える。枠が減る場合は、はみ出す画像があることを伝える */
  function changePaper(next: PaperKind) {
    if (next === paper) return
    const nextCap = paperCapacity(next)
    const overflow = files.slice(nextCap).filter(Boolean).length
    if (overflow > 0) {
      const ok = confirm(
        `「${PAPERS[next].label}」で使えるのはカード${nextCap}枚までです。\n` +
        `${nextCap + 1}枚目以降に選んだ${overflow}枚は、この用紙では使われません。\n` +
        `（選んだ状態は残るので、「${PAPERS[paper].label}」に戻せばまた使えます）`,
      )
      if (!ok) return
    }
    setDoneMsg('')
    setPaper(next)
  }

  // 指定した枠の画像を差し替える（同じ枠を選び直しても反映される）
  function pickSlot(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setDoneMsg('')
    setPreviews(prev => {
      const next = [...prev]
      if (next[i]) URL.revokeObjectURL(next[i])
      next[i] = f ? URL.createObjectURL(f) : ''
      return next
    })
    setFiles(prev => { const next = [...prev]; next[i] = f; return next })
    // 同じファイルを再選択できるよう、input の値をリセットしておく
    e.target.value = ''
  }

  function clearSlot(i: number) {
    setDoneMsg('')
    setPreviews(prev => {
      const next = [...prev]
      if (next[i]) URL.revokeObjectURL(next[i])
      next[i] = ''
      return next
    })
    setFiles(prev => { const next = [...prev]; next[i] = null; return next })
    setLocks(prev => { const next = [...prev]; next[i] = true; return next })
    setFocuses(prev => { const next = [...prev]; next[i] = DEFAULT_FOCUS; return next })
  }

  function setLockAt(i: number, v: boolean) {
    setLocks(prev => { const next = [...prev]; next[i] = v; return next })
  }
  function setFocusAt(i: number, v: Focus) {
    setFocuses(prev => { const next = [...prev]; next[i] = v; return next })
  }

  // この用紙で実際に使われる枚数
  const usedCount = files.slice(0, capacity).filter(Boolean).length
  // まだ画像が入っていない枠の番号
  const emptySlots = Array.from({ length: capacity }, (_, i) => i).filter(i => !files[i])

  /* 選ぶ元の一覧。自分の評価と集めたカードで持っている項目名が違うので、
     ここで共通の形（id / 表示用の見出し / カードに渡す内容）に揃えておく。 */
  type PickSource = { key: string; title: string; sub: string; hex: string; variant: 'normal' | 'collection'; row: any }

  const pickList: PickSource[] = (pickSrc === 'mine'
    ? myReviews.map(r => ({
        key: `mine:${r.id}`,
        title: r.tea_name ?? '不明',
        sub: [r.brand_name, r.drank_at?.slice(0, 10)].filter(Boolean).join(' / '),
        hex: r.color_hex ?? '#C8A96E',
        variant: 'normal' as const,
        row: r,
      }))
    : collected.map(c => ({
        key: `col:${c.collection_id}`,
        title: c.tea_name ?? '不明',
        sub: [c.brand_name, c.author_name ?? '匿名'].filter(Boolean).join(' / '),
        hex: c.color_hex ?? '#C8A96E',
        variant: 'collection' as const,
        row: c,
      }))
  ).filter(p => {
    const q = pickQuery.trim().toLowerCase()
    if (!q) return true
    return `${p.title} ${p.sub}`.toLowerCase().includes(q)
  })

  /** 選び直しのため、絵柄を選ぶ画面を開く */
  function openPicker() {
    setPicked(new Set())
    setPickQuery('')
    setPickerOpen(true)
  }

  function togglePick(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      // 空いている枠の数を超えては選べないようにする
      if (next.size >= emptySlots.length) {
        alert(`空いている枠は${emptySlots.length}個です。先に不要な枠を削除してください。`)
        return next
      }
      next.add(id)
      return next
    })
  }

  /** 選んだものを、その場で画像にして空いている枠へ入れる */
  async function applyPicked() {
    // 元の一覧（絞り込み前）から探す。絞り込みを変えても選択は消えないようにするため
    const all: PickSource[] = [
      ...myReviews.map(r => ({
        key: `mine:${r.id}`, title: r.tea_name ?? '不明', sub: '', hex: '',
        variant: 'normal' as const, row: r,
      })),
      ...collected.map(c => ({
        key: `col:${c.collection_id}`, title: c.tea_name ?? '不明', sub: '', hex: '',
        variant: 'collection' as const, row: c,
      })),
    ]
    const targets = all.filter(p => picked.has(p.key))
    if (targets.length === 0) { setPickerOpen(false); return }

    setBuilding(targets.length)
    try {
      const madeFiles: File[] = []
      for (const t of targets) {
        const c = t.row
        /* カード画像は保存していないため、評価の内容からそのつど作る。
           自分の評価は通常の配色、集めたカードは COLLECTION 版になる。 */
        const blob = await generateTeaCard({
          variant: t.variant,
          collected_by: t.variant === 'collection' ? (myName || 'ゲスト') : null,
          tea_name: c.tea_name,
          brand_name: c.brand_name,
          tea_garden: c.tea_garden,
          origin_country: c.origin_country,
          shop_name: c.shop_name,
          // 自分の評価は自分が飲んだ人、集めたカードは投稿した人
          user_name: t.variant === 'collection' ? (c.author_name ?? '匿名') : (myName || null),
          drank_at: c.drank_at,
          color_hex: c.color_hex,
          color_name: c.color_name,
          comment: c.comment,
          aroma_notes: c.aroma_notes,
          brew_method: c.brew_method,
          steep_seconds: c.steep_seconds,
          tea_grams_per_100ml: c.tea_grams_per_100ml,
          tea_grams: c.tea_grams,
          water_ml: c.water_ml,
          accompaniments: c.accompaniments,
          score_aroma: c.score_aroma ?? 3,
          score_astringency: c.score_astringency ?? 3,
          score_richness: c.score_richness ?? 3,
          score_color_depth: c.score_color_depth ?? 3,
        })
        madeFiles.push(new File([blob], `${c.tea_name ?? 'card'}.png`, { type: 'image/png' }))
      }

      // 空いている枠へ、選んだ順に入れる
      setFiles(prev => {
        const next = [...prev]
        madeFiles.forEach((f, i) => { const slot = emptySlots[i]; if (slot !== undefined) next[slot] = f })
        return next
      })
      setPreviews(prev => {
        const next = [...prev]
        madeFiles.forEach((f, i) => {
          const slot = emptySlots[i]
          if (slot === undefined) return
          if (next[slot]) URL.revokeObjectURL(next[slot])
          next[slot] = URL.createObjectURL(f)
        })
        return next
      })
      // 評価カードは枠と同じ比率なので、位置の調整は不要
      setLocks(prev => {
        const next = [...prev]
        madeFiles.forEach((_, i) => { const slot = emptySlots[i]; if (slot !== undefined) next[slot] = true })
        return next
      })

      setDoneMsg('')
      setPickerOpen(false)
    } catch (e: any) {
      alert(e?.message ?? 'カードの作成に失敗しました')
    } finally {
      setBuilding(0)
    }
  }

  async function run() {
    if (usedCount === 0) { alert('評価カードの画像を選んでください'); return }
    if (cost > 0 && !confirm(`${cost}ptを消費して印刷用ファイルを作成します。よろしいですか？`)) return

    setWorking(true)
    setDoneMsg('')
    try {
      // 消費ポイントが0のときはポイント処理そのものを行わない
      if (cost > 0) {
        const { data: consumed, error } = await supabase.rpc('consume_points', {
          p_amount: cost, p_feature: 'card_print',
        })
        if (error) { alert(error.message); return }
        const row = Array.isArray(consumed) ? consumed[0] : consumed
        if (row && row.success === false) { alert(row.message || 'ポイントが不足しています'); return }
        if (row && typeof row.remaining === 'number') setPoints(row.remaining)
      }

      const blob = await composeSheet(files.slice(0, capacity), {
        paper,
        cutGuide,
        // 位置を固定している枠は中央のまま（＝評価カードは従来どおり）
        focus: focuses.slice(0, capacity).map((f, i) => (locks[i] ? null : f)),
      })
      downloadSheet(blob, paper)
      setDoneMsg('印刷用ファイルをダウンロードしました。')
    } catch (e: any) {
      alert(e?.message ?? '変換に失敗しました')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className={styles.page}><p className={styles.loading}>読み込み中…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.stickyHead}>
        <h1 className={styles.title}>🖨 印刷用に変換</h1>
        <p className={styles.lead}>
          評価カードをまとめて、{spec.sizeLabel}サイズ（{spec.wMM}×{spec.hMM}mm）の
          画像に変換します。コンビニのカラー印刷で「{spec.printName}」を選んで印刷してください。
          {spec.resultNote}
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.costRow}>
          <span className={styles.costLabel}>消費ポイント</span>
          <span className={styles.costValue}>
            {isAdmin ? '消費なし（管理者・製作者）' : cost === 0 ? '無料' : `${cost}pt`}
          </span>
          {!isAdmin && points !== null && (
            <span className={styles.balance}>所持: {points}pt</span>
          )}
        </div>

        {/* 用紙の選択 */}
        <label className={styles.label}>用紙のサイズ</label>
        <div className={styles.paperRow}>
          {PAPER_KINDS.map(k => (
            <button
              key={k}
              type="button"
              className={paper === k ? styles.paperBtnOn : styles.paperBtn}
              onClick={() => changePaper(k)}
            >
              <span className={styles.paperName}>{PAPERS[k].label}</span>
              <span className={styles.paperSize}>{PAPERS[k].wMM}×{PAPERS[k].hMM}mm</span>
              <span className={styles.paperResultLabel}>印刷後のサイズ</span>
              <span className={styles.paperCount}>{PAPERS[k].resultSize}</span>
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {spec.hint}
        </p>

        <label className={styles.label}>評価カードの画像</label>
        <p className={styles.hint}>
          それぞれの枠に、評価の編集画面で作成した「評価カード画像」を選んでください。
          空けたままの枠は余白になります（{capacity}枚すべて埋める必要はありません）。
        </p>

        {/* 集めたカードから一括で入れる導線。A4の8枠を1枚ずつ選ぶのは手間なので、
            画像を用意しなくてもここからまとめて入れられるようにしている。 */}
        {(myReviews.length > 0 || (collectAvailable && collected.length > 0)) && (
          <div className={styles.pickRow}>
            <button className={styles.pickBtn} onClick={openPicker} disabled={emptySlots.length === 0}>
              🍵 記録からカードを選ぶ
            </button>
            <span className={styles.pickHint}>
              {emptySlots.length === 0
                ? 'すべての枠が埋まっています'
                : `空いている枠: ${emptySlots.length}個`}
            </span>
          </div>
        )}

        <div className={styles.slots}>
          {Array.from({ length: capacity }, (_, i) => {
            const file = files[i]
            const preview = previews[i]
            const lock = locks[i]
            const focus = focuses[i]
            const label = paper === 'postcard1'
              ? 'カード'
              : paper === 'postcard'
                ? (i === 0 ? '① 上段' : '② 下段')
                : `${CIRCLED[i]} ${Math.floor(i / 2) + 1}段目の${i % 2 === 0 ? '左' : '右'}`
            return (
              <div key={i} className={styles.slot}>
                <p className={styles.slotTitle}>{label}</p>
                {preview ? (
                  <>
                    {/* 仕上がりと同じ枠。ドラッグとピンチで位置・大きさを合わせられる */}
                    <CropPreview
                      src={preview}
                      value={focus}
                      onChange={v => setFocusAt(i, v as Focus)}
                      disabled={lock}/>
                    <p className={styles.slotFileName}>{file?.name}</p>

                    {/* 位置の固定と調整 */}
                    <label className={styles.lockRow}>
                      <input type="checkbox"
                        checked={lock}
                        onChange={e => setLockAt(i, e.target.checked)}/>
                      <span>位置を固定する（評価カード向け）</span>
                    </label>
                    {!lock && (
                      <div className={styles.focusBox}>
                        <p className={styles.focusHint}>
                          枠の中をドラッグで移動、2本指のピンチで拡大・縮小できます。
                          はみ出した部分は切り取られます。
                        </p>
                        <div className={styles.focusRow}>
                          <span className={styles.focusLabel}>大きさ</span>
                          <input type="range" min={100} max={400}
                            value={Math.round(focus.zoom * 100)}
                            onChange={e => setFocusAt(i, { ...focus, zoom: Number(e.target.value) / 100 })}/>
                          <span className={styles.focusVal}>
                            {Math.round(focus.zoom * 100)}%
                          </span>
                        </div>
                        <button type="button" className={styles.resetBtn}
                          onClick={() => setFocusAt(i, DEFAULT_FOCUS)}>
                          位置をリセット
                        </button>
                      </div>
                    )}

                    <div className={styles.slotActions}>
                      <label className={styles.slotChangeBtn}>
                        変更
                        <input type="file" accept="image/*" hidden
                          onChange={e => pickSlot(i, e)}/>
                      </label>
                      <button className={styles.slotClearBtn} onClick={() => clearSlot(i)}>
                        削除
                      </button>
                    </div>
                  </>
                ) : (
                  <label className={styles.slotEmpty}>
                    <span className={styles.slotPlusIcon}>＋</span>
                    <span className={styles.slotEmptyText}>画像を選ぶ</span>
                    <input type="file" accept="image/*" hidden
                      onChange={e => pickSlot(i, e)}/>
                  </label>
                )}
              </div>
            )
          })}
        </div>

        {spec.cutGuide !== false && (
          <label className={styles.checkRow}>
            <input type="checkbox" checked={cutGuide} onChange={e => setCutGuide(e.target.checked)}/>
            <span>切り取り線を入れる</span>
          </label>
        )}

        <button className={styles.runBtn} onClick={run} disabled={working || usedCount === 0}>
          {working ? '変換中…' : `印刷用ファイルを作成する（${usedCount}枚）`}
        </button>

        {doneMsg && <p className={styles.done}>✓ {doneMsg}</p>}
      </div>

      {/* 集めたカードを選ぶ画面 */}
      {pickerOpen && (
        <div className={styles.modalBack} onClick={() => building === 0 && setPickerOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>カードを選ぶ</p>
            <p className={styles.modalLead}>
              空いている{emptySlots.length}個の枠に、選んだ順で入ります。
              画像は選んだあとに作るので、少し時間がかかります。
            </p>

            {/* 選ぶ元の切り替え。集めたカードが無い環境では自分の評価だけを出す */}
            {collectAvailable && collected.length > 0 && (
              <div className={styles.srcRow}>
                <button
                  className={`${styles.srcBtn} ${pickSrc === 'mine' ? styles.srcBtnOn : ''}`}
                  onClick={() => setPickSrc('mine')} disabled={building > 0}>
                  自分の評価（{myReviews.length}）
                </button>
                <button
                  className={`${styles.srcBtn} ${pickSrc === 'collected' ? styles.srcBtnOn : ''}`}
                  onClick={() => setPickSrc('collected')} disabled={building > 0}>
                  ◆ 集めたカード（{collected.length}）
                </button>
              </div>
            )}

            {/* 記録が増えると探しにくいので、紅茶名やブランド名で絞り込めるようにする */}
            <input
              className={styles.pickSearch}
              type="search"
              placeholder="紅茶名・ブランド名で絞り込む"
              value={pickQuery}
              onChange={e => setPickQuery(e.target.value)}
              disabled={building > 0}/>

            <div className={styles.pickList}>
              {pickList.length === 0 ? (
                <p className={styles.pickEmpty}>
                  {pickQuery ? '一致する記録がありません' : 'カードにできる記録がありません'}
                </p>
              ) : pickList.map(p => {
                const on = picked.has(p.key)
                return (
                  <button
                    key={p.key}
                    className={`${styles.pickItem} ${on ? styles.pickItemOn : ''}`}
                    onClick={() => togglePick(p.key)}
                    disabled={building > 0}>
                    <span className={styles.pickCheck}>{on ? '✓' : ''}</span>
                    <span className={styles.pickSwatch} style={{ background: p.hex }}/>
                    <span className={styles.pickInfo}>
                      <span className={styles.pickName}>{p.title}</span>
                      <span className={styles.pickSub}>{p.sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel}
                onClick={() => setPickerOpen(false)} disabled={building > 0}>
                キャンセル
              </button>
              <button className={styles.modalOk}
                onClick={applyPicked} disabled={building > 0 || picked.size === 0}>
                {building > 0 ? `作成中… (${building}枚)` : `${picked.size}枚を入れる`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.guide}>
        <h2 className={styles.guideTitle}>コンビニで印刷するには</h2>
        <ol className={styles.guideList}>
          <li>作成したファイルを、各社の印刷アプリやネットプリントに登録します。</li>
          <li>用紙サイズは「<strong>{spec.printName}</strong>」、カラーを選びます。</li>
          <li>「原寸」または「等倍」で印刷すると、想定どおりの大きさになります。</li>
          <li>{spec.resultNote}</li>
        </ol>
        <p className={styles.guideNote}>
          ※ 印刷機の設定によっては、用紙のふちが少し切れることがあります。
          仕上がりが気になる場合は「フチなし」設定を避けると安定します。
        </p>
      </div>
    </div>
  )
}
