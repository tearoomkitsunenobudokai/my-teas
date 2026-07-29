'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  composePostcard, downloadPostcard,
  POSTCARD_W_MM, POSTCARD_H_MM, CARD_W_MM, CARD_H_MM,
} from '@/lib/cardPrint'
import styles from './card-print.module.css'

export default function CardPrintPage() {
  const supabase = createClient()

  // 消費ポイントはDB（feature_costs）から取得する。
  // 開発中は0のため無料。有料化は管理画面「💎 ポイント設定」から変更できる。
  const [cost, setCost] = useState(0)
  const [points, setPoints] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // 上段・下段をそれぞれ別のファイルとして扱う（片方だけでも作成できる）
  const [slot1, setSlot1] = useState<File | null>(null)
  const [slot2, setSlot2] = useState<File | null>(null)
  const [preview1, setPreview1] = useState('')
  const [preview2, setPreview2] = useState('')
  const [cutGuide, setCutGuide] = useState(true)
  const [working, setWorking] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }
    const [{ data: c }, { data: profile }] = await Promise.all([
      supabase.rpc('get_feature_cost', { p_feature: 'card_print' }),
      supabase.from('profiles').select('is_admin,is_creator,points').eq('id', user.id).single(),
    ])
    if (typeof c === 'number') setCost(c)
    setIsAdmin((profile?.is_admin || profile?.is_creator) ?? false)
    setPoints(profile?.points ?? 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // 指定したスロットの画像を差し替える（同じスロットを選び直しても反映される）
  function pickSlot(slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setDoneMsg('')
    if (slot === 1) {
      if (preview1) URL.revokeObjectURL(preview1)
      setSlot1(f)
      setPreview1(f ? URL.createObjectURL(f) : '')
    } else {
      if (preview2) URL.revokeObjectURL(preview2)
      setSlot2(f)
      setPreview2(f ? URL.createObjectURL(f) : '')
    }
    // 同じファイルを再選択できるよう、input の値をリセットしておく
    e.target.value = ''
  }

  function clearSlot(slot: 1 | 2) {
    setDoneMsg('')
    if (slot === 1) {
      if (preview1) URL.revokeObjectURL(preview1)
      setSlot1(null); setPreview1('')
    } else {
      if (preview2) URL.revokeObjectURL(preview2)
      setSlot2(null); setPreview2('')
    }
  }

  async function run() {
    if (!slot1 && !slot2) { alert('評価カードの画像を選んでください'); return }
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

      const blob = await composePostcard([slot1, slot2], { cutGuide })
      downloadPostcard(blob)
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
      <h1 className={styles.title}>🖨 印刷用に変換</h1>
      <p className={styles.lead}>
        評価カードを2枚まとめて、ハガキサイズ（{POSTCARD_W_MM}×{POSTCARD_H_MM}mm）の
        画像に変換します。コンビニのカラー印刷で「はがき」を選んで印刷し、
        線に沿って切り取ると名刺サイズのカードになります。
      </p>

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

        <label className={styles.label}>評価カードの画像</label>
        <p className={styles.hint}>
          上段・下段それぞれに、評価の編集画面で作成した「評価カード画像」を選んでください。
          片方だけでも作成できます（もう一方は空欄になります）。
        </p>

        <div className={styles.slots}>
          {([1, 2] as const).map(n => {
            const file = n === 1 ? slot1 : slot2
            const preview = n === 1 ? preview1 : preview2
            return (
              <div key={n} className={styles.slot}>
                <p className={styles.slotTitle}>{n === 1 ? '① 上段' : '② 下段'}</p>
                {preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={`カード${n}`} className={styles.slotPreview}/>
                    <p className={styles.slotFileName}>{file?.name}</p>
                    <div className={styles.slotActions}>
                      <label className={styles.slotChangeBtn}>
                        変更
                        <input type="file" accept="image/*" hidden
                          onChange={e => pickSlot(n, e)}/>
                      </label>
                      <button className={styles.slotClearBtn} onClick={() => clearSlot(n)}>
                        削除
                      </button>
                    </div>
                  </>
                ) : (
                  <label className={styles.slotEmpty}>
                    <span className={styles.slotPlusIcon}>＋</span>
                    <span className={styles.slotEmptyText}>画像を選ぶ</span>
                    <input type="file" accept="image/*" hidden
                      onChange={e => pickSlot(n, e)}/>
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={cutGuide} onChange={e => setCutGuide(e.target.checked)}/>
          <span>切り取り線を入れる</span>
        </label>

        <button className={styles.runBtn} onClick={run} disabled={working || (!slot1 && !slot2)}>
          {working ? '変換中…' : '印刷用ファイルを作成する'}
        </button>

        {doneMsg && <p className={styles.done}>✓ {doneMsg}</p>}
      </div>

      <div className={styles.guide}>
        <h2 className={styles.guideTitle}>コンビニで印刷するには</h2>
        <ol className={styles.guideList}>
          <li>作成したファイルを、各社の印刷アプリやネットプリントに登録します。</li>
          <li>用紙サイズは「<strong>はがき</strong>」、カラーを選びます。</li>
          <li>「原寸」または「等倍」で印刷すると、切り取り後に名刺サイズ（{CARD_W_MM}×{CARD_H_MM}mm）になります。</li>
          <li>印刷後、切り取り線に沿ってカットしてください。</li>
        </ol>
        <p className={styles.guideNote}>
          ※ 印刷機の設定によっては、用紙のふちが少し切れることがあります。
          仕上がりが気になる場合は「フチなし」設定を避けると安定します。
        </p>
      </div>
    </div>
  )
}
