'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AROMA_PRESETS, ReviewScores, SCORE_LABELS, SCORE_DESCRIPTIONS } from '@/types'
import styles from './mobile.module.css'

const MAX_NAME = 20
const MAX_TEXT = 300
const BREW_METHODS = ['リーフ', 'ティーバッグ', '手鍋', '粉末', '希釈液', '不明']
const ACCOMPANIMENTS = ['なし（ストレート）', '蜂蜜', 'ミルク', '砂糖', 'レモン', 'アイス（グラス）']

const TOTAL_STEPS = 7

export default function MobileReviewPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  // 選択肢（DBから取得）
  const [palette, setPalette] = useState<{ hex: string; name: string }[]>([])
  const [shops, setShops] = useState<{ id: string; name: string; prefecture: string | null }[]>([])

  // 入力値（既存フォームと同じ項目）
  const [teaName, setTeaName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [teaGarden, setTeaGarden] = useState('')
  const [colorHex, setColorHex] = useState('')
  const [scores, setScores] = useState<ReviewScores>({
    score_aroma: 3, score_richness: 3, score_color_depth: 3, score_astringency: 3,
  })
  const [aromaNotes, setAromaNotes] = useState<string[]>([])
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [drankAt, setDrankAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [shopName, setShopName] = useState('')
  const [brewMethod, setBrewMethod] = useState('')
  const [teaGrams, setTeaGrams] = useState('')
  const [steepSec, setSteepSec] = useState('')
  const [accs, setAccs] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { router.push('/auth'); return }
    setUserId(user.id)
    const [{ data: colors }, { data: shopRows }] = await Promise.all([
      supabase.from('tea_colors').select('hex,name')
        .order('is_official', { ascending: false }).order('sort_order'),
      supabase.from('certified_shop_masters').select('id,name,prefecture').order('name'),
    ])
    setPalette(colors ?? [])
    setShops(shopRows ?? [])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  }

  async function save() {
    if (!teaName.trim()) { alert('お茶の名前を入力してください'); return }
    setSaving(true)
    const payload: any = {
      user_id: userId,
      tea_name: teaName.trim(),
      brand_name: brandName.trim() || null,
      tea_garden: teaGarden.trim() || null,
      shop_name: shopName || null,
      color_hex: colorHex || null,
      aroma_notes: aromaNotes.length ? aromaNotes : null,
      ...scores,
      comment: comment || null,
      notes: notes || null,
      is_public: isPublic,
      drank_at: drankAt,
      brew_method: brewMethod || null,
      steep_seconds: steepSec ? parseInt(steepSec) : null,
      tea_grams_per_100ml: teaGrams ? parseFloat(teaGrams) : null,
      accompaniments: accs.length ? accs : null,
    }
    const { error } = await supabase.from('reviews').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    setDone(true)
  }

  if (loading) return <div className={styles.wrap}><p className={styles.loading}>読み込み中…</p></div>

  if (done) {
    return (
      <div className={styles.wrap}>
        <div className={styles.doneWrap}>
          <div className={styles.doneIcon}>🍵</div>
          <p className={styles.doneTitle}>記録しました！</p>
          <p className={styles.doneText}>
            「{teaName}」の評価を保存しました。<br />評価カード画像も作成できます。
          </p>
          <div className={styles.doneBtns}>
            <button className={styles.next} onClick={() => router.push('/dashboard/reviews')}>
              評価一覧を見る
            </button>
            <button className={styles.back} style={{ width: '100%' }} onClick={() => window.location.reload()}>
              続けてもう1杯記録する
            </button>
          </div>
        </div>
      </div>
    )
  }

  const canNext = step !== 0 || teaName.trim().length > 0

  return (
    <div className={styles.wrap}>
      {/* 進捗 */}
      <div className={styles.top}>
        <div className={styles.topRow}>
          <button className={styles.close} onClick={() => router.push('/dashboard/reviews')}>✕</button>
          <span className={styles.stepNum}>{step + 1} / {TOTAL_STEPS}</span>
          <span style={{ width: 22 }} />
        </div>
        <div className={styles.bar}>
          <div className={styles.barIn} style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <div className={styles.body}>
        {/* ① 名前 */}
        {step === 0 && (
          <>
            <p className={styles.q}>どのお茶を飲みましたか？</p>
            <p className={styles.sub}>紅茶の名前を入力してください</p>
            <input className={styles.input} value={teaName} maxLength={MAX_NAME}
              onChange={e => setTeaName(e.target.value.slice(0, MAX_NAME))}
              placeholder="例: ダージリン 1stフラッシュ" />
            <div className={styles.counter}>{teaName.length}/{MAX_NAME}</div>
            <p className={styles.subGap}>ブランド名（任意）</p>
            <input className={styles.input} value={brandName} maxLength={30}
              onChange={e => setBrandName(e.target.value)} placeholder="例: ジークレフ" />
            <p className={styles.subGap}>茶園名（任意）</p>
            <input className={styles.input} value={teaGarden} maxLength={30}
              onChange={e => setTeaGarden(e.target.value)} placeholder="例: タルザム茶園" />
          </>
        )}

        {/* ② 水色 */}
        {step === 1 && (
          <>
            <p className={styles.q}>水色はどの色に近いですか？</p>
            <p className={styles.sub}>淹れた紅茶の色をタップして選んでください（任意）</p>
            <div className={styles.colors}>
              {palette.map(c => (
                <button key={c.hex} className={`${styles.col} ${colorHex === c.hex ? styles.colOn : ''}`}
                  onClick={() => setColorHex(colorHex === c.hex ? '' : c.hex)}>
                  <span className={styles.sw} style={{ background: c.hex }} />
                  <span className={styles.colName}>{c.name}</span>
                </button>
              ))}
            </div>
            {palette.length === 0 && (
              <p className={styles.sub}>カラーパレットが未登録です。あとから編集画面で設定できます。</p>
            )}
          </>
        )}

        {/* ③ スコア */}
        {step === 2 && (
          <>
            <p className={styles.q}>味わいを5段階で</p>
            <p className={styles.sub}>数字をタップしてください</p>
            {(Object.keys(SCORE_LABELS) as (keyof ReviewScores)[]).map(k => (
              <div key={k} className={styles.scoreBlock}>
                <p className={styles.scoreName}>{SCORE_LABELS[k]}</p>
                <div className={styles.scoreEdge}>
                  <span>{SCORE_DESCRIPTIONS[k].weak}</span>
                  <span>{SCORE_DESCRIPTIONS[k].strong}</span>
                </div>
                <div className={styles.scoreBtns}>
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v}
                      className={`${styles.sc} ${scores[k] === v ? styles.scOn : ''}`}
                      onClick={() => setScores(s => ({ ...s, [k]: v }))}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ④ 香り */}
        {step === 3 && (
          <>
            <p className={styles.q}>どんな香りでしたか？</p>
            <p className={styles.sub}>系統を開いて選べます（複数可・任意）</p>
            {AROMA_PRESETS.map(g => {
              const cnt = g.items.filter(t => aromaNotes.includes(t)).length
              const open = openGroup === g.group
              return (
                <div key={g.group}>
                  <button className={`${styles.grpBtn} ${open ? styles.grpOpen : ''}`}
                    onClick={() => setOpenGroup(open ? null : g.group)}>
                    <span>{g.group}</span>
                    <span className={styles.cnt}>{cnt ? `${cnt}件` : '▾'}</span>
                  </button>
                  {open && (
                    <div className={styles.tagWrap}>
                      {g.items.map(t => (
                        <button key={t}
                          className={`${styles.tag} ${aromaNotes.includes(t) ? styles.tagOn : ''}`}
                          onClick={() => toggle(aromaNotes, t, setAromaNotes)}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ⑤ 日付・場所 */}
        {step === 4 && (
          <>
            <p className={styles.q}>いつ・どこで飲みましたか？</p>
            <p className={styles.sub}>飲んだ日</p>
            <input className={styles.input} type="date" value={drankAt}
              onChange={e => setDrankAt(e.target.value)} />
            <p className={styles.subGap}>お店（任意）</p>
            <input className={styles.input} value={shopName} maxLength={60}
              onChange={e => setShopName(e.target.value)}
              placeholder="お店の名前を入力（自由入力できます）" />
            <p className={styles.pickLabel}>認定店から選ぶ場合はこちら</p>
            <select className={styles.input} value={shops.some(s => s.name === shopName) ? shopName : ''}
              onChange={e => { if (e.target.value) setShopName(e.target.value) }}>
              <option value="">認定店リストから選択…</option>
              {shops.map(s => (
                <option key={s.id} value={s.name}>
                  {s.name}{s.prefecture ? `（${s.prefecture}）` : ''}
                </option>
              ))}
            </select>
            {shopName && (
              <button className={styles.clearBtn} onClick={() => setShopName('')}>
                お店の入力をクリア
              </button>
            )}
          </>
        )}

        {/* ⑥ 詳細（淹れ方・分量・添え物） */}
        {step === 5 && (
          <>
            <p className={styles.q}>淹れ方の詳細</p>
            <p className={styles.sub}>わかる範囲で記録できます（すべて任意）</p>

            <p className={styles.fieldLabel}>抽出方法</p>
            <div className={styles.chips}>
              {BREW_METHODS.map(m => (
                <button key={m} className={`${styles.chip} ${brewMethod === m ? styles.chipOn : ''}`}
                  onClick={() => setBrewMethod(brewMethod === m ? '' : m)}>{m}</button>
              ))}
            </div>

            <div className={styles.twoCol}>
              <div>
                <p className={styles.fieldLabel}>茶葉量</p>
                <div className={styles.unitRow}>
                  <input className={styles.input} type="number" inputMode="decimal" step="0.1"
                    value={teaGrams} onChange={e => setTeaGrams(e.target.value)} placeholder="2" />
                  <span className={styles.unit}>g/100ml</span>
                </div>
              </div>
              <div>
                <p className={styles.fieldLabel}>抽出時間</p>
                <div className={styles.unitRow}>
                  <input className={styles.input} type="number" inputMode="numeric"
                    value={steepSec} onChange={e => setSteepSec(e.target.value)} placeholder="180" />
                  <span className={styles.unit}>秒</span>
                </div>
              </div>
            </div>

            <p className={styles.fieldLabel}>添え物（複数可）</p>
            <div className={styles.chips}>
              {ACCOMPANIMENTS.map(a => (
                <button key={a} className={`${styles.chip} ${accs.includes(a) ? styles.chipOn : ''}`}
                  onClick={() => toggle(accs, a, setAccs)}>{a}</button>
              ))}
            </div>
          </>
        )}

        {/* ⑦ メモ・公開 */}
        {step === 6 && (
          <>
            <p className={styles.q}>記録を残しましょう</p>
            <p className={styles.sub}>その他の情報（産地・グレードなど・任意）</p>
            <textarea className={styles.textarea} rows={3} value={notes} maxLength={MAX_TEXT}
              onChange={e => setNotes(e.target.value.slice(0, MAX_TEXT))}
              placeholder="例: 2024年 DJ-9 タルザム茶園" />
            <div className={styles.counter}>{notes.length}/{MAX_TEXT}</div>

            <p className={styles.subGap}>感想コメント（任意）</p>
            <textarea className={styles.textarea} rows={3} value={comment} maxLength={MAX_TEXT}
              onChange={e => setComment(e.target.value.slice(0, MAX_TEXT))} placeholder="感想・メモ…" />
            <div className={styles.counter}>{comment.length}/{MAX_TEXT}</div>

            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>コミュニティに公開</span>
              <button className={`${styles.sw2} ${isPublic ? styles.sw2On : ''}`}
                onClick={() => setIsPublic(!isPublic)} aria-label="公開切り替え" />
            </div>
          </>
        )}
      </div>

      {/* 操作ボタン（親指ゾーン） */}
      <div className={styles.foot}>
        {step > 0 && (
          <button className={styles.back} onClick={() => setStep(s => s - 1)}>戻る</button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button className={styles.next} disabled={!canNext} onClick={() => setStep(s => s + 1)}>次へ</button>
        ) : (
          <button className={styles.next} disabled={saving} onClick={save}>
            {saving ? '保存中…' : '保存する'}
          </button>
        )}
      </div>
    </div>
  )
}
