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

  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
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

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 2)
    setFiles(picked)
    setDoneMsg('')
    // プレビュー用URLを作る（前のURLは解放する）
    previews.forEach(u => URL.revokeObjectURL(u))
    setPreviews(picked.map(f => URL.createObjectURL(f)))
  }

  async function run() {
    if (files.length === 0) { alert('評価カードの画像を選んでください'); return }
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

      const blob = await composePostcard(files, { cutGuide })
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

        <label className={styles.label}>評価カードの画像（最大2枚）</label>
        <input type="file" accept="image/*" multiple onChange={onPick} className={styles.file}/>
        <p className={styles.hint}>
          評価の編集画面で作成・保存した「評価カード画像」を選んでください。
          1枚だけでも作成できます（下段は空欄になります）。
        </p>

        {previews.length > 0 && (
          <div className={styles.previewArea}>
            <p className={styles.previewTitle}>選択中（{previews.length}枚）</p>
            <div className={styles.previewGrid}>
              {previews.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt={`カード${i + 1}`} className={styles.preview}/>
              ))}
            </div>
          </div>
        )}

        <label className={styles.checkRow}>
          <input type="checkbox" checked={cutGuide} onChange={e => setCutGuide(e.target.checked)}/>
          <span>切り取り線を入れる</span>
        </label>

        <button className={styles.runBtn} onClick={run} disabled={working || files.length === 0}>
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
