'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { AROMA_PRESETS } from '@/types'  // フォールバック用
import styles from './AromaAnalysis.module.css'

interface Props {
  notes: string[]
  description: string
  onChange: (notes: string[], description: string) => void
  readOnly?: boolean
  maxNotes?: number  // 選択できる香りの最大数
}

export default function AromaAnalysis({ notes, description, onChange, readOnly = false, maxNotes }: Props) {
  const [customInput, setCustomInput] = useState('')
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  // DBからプリセットを取得（失敗時はフォールバック）
  const [presets, setPresets] = useState<{ group_name: string; items: string[] }[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('aroma_presets').select('group_name, items').order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPresets(data)
        } else {
          // テーブルが存在しない or データがない場合はフォールバック
          setPresets(AROMA_PRESETS.map(p => ({ group_name: p.group, items: p.items })))
        }
      })
      .catch(() => {
        setPresets(AROMA_PRESETS.map(p => ({ group_name: p.group, items: p.items })))
      })
  }, [])

  function toggleNote(note: string) {
    if (readOnly) return
    if (notes.includes(note)) {
      // 解除
      onChange(notes.filter(n => n !== note), description)
    } else {
      // 追加：上限チェック
      if (maxNotes && notes.length >= maxNotes) {
        alert(`香りの選択は${maxNotes}つまでです。解除してから選択してください。`)
        return
      }
      onChange([...notes, note], description)
    }
  }

  function addCustom() {
    const val = customInput.trim()
    if (!val || notes.includes(val)) { setCustomInput(''); return }
    if (maxNotes && notes.length >= maxNotes) {
      alert(`香りの選択は${maxNotes}つまでです。解除してから追加してください。`)
      return
    }
    onChange([...notes, val], description)
    setCustomInput('')
  }

  function removeNote(note: string) {
    if (readOnly) return
    onChange(notes.filter(n => n !== note), description)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>🌸 香り分析</span>
        {notes.length > 0 && (
          <span className={`${styles.countBadge} ${maxNotes && notes.length >= maxNotes ? styles.countBadgeMax : ''}`}>
            {notes.length}{maxNotes ? ` / ${maxNotes}` : ''}個選択中
          </span>
        )}
      </div>

      {/* 選択済みタグ */}
      {notes.length > 0 && (
        <div className={styles.selectedTags}>
          {notes.map(n => (
            <span key={n} className={styles.selectedTag}>
              {n}
              {!readOnly && (
                <button className={styles.removeBtn} onClick={() => removeNote(n)}>×</button>
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          {/* DBから取得したプリセット選択 */}
          <div className={styles.presets}>
            {presets.map(group => (
              <div key={group.group_name} className={styles.group}>
                <button
                  className={`${styles.groupBtn} ${openGroup === group.group_name ? styles.groupBtnOpen : ''}`}
                  onClick={() => setOpenGroup(openGroup === group.group_name ? null : group.group_name)}>
                  {group.group_name}
                  <span className={styles.groupArrow}>{openGroup === group.group_name ? '▲' : '▼'}</span>
                </button>
                {openGroup === group.group_name && (
                  <div className={styles.groupItems}>
                    {group.items.map((item: string) => (
                      <button
                        key={item}
                        className={`${styles.presetTag} ${notes.includes(item) ? styles.presetTagActive : ''}`}
                        onClick={() => toggleNote(item)}>
                        {item}
                        {notes.includes(item) && <span className={styles.checkMark}> ✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* カスタム入力 */}
          <div className={styles.customRow}>
            <input
              className={styles.customInput}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="その他の香りを入力（例: 紅茶花…）"
            />
            <button className={styles.addBtn} onClick={addCustom} disabled={!customInput.trim()}>
              追加
            </button>
          </div>
        </>
      )}

      {/* 自由記入の香り分析 */}
      <div className={styles.descWrap}>
        <label className={styles.descLabel}>香りの詳細メモ</label>
        {readOnly ? (
          description
            ? <p className={styles.descText}>{description}</p>
            : <p className={styles.descEmpty}>—</p>
        ) : (
          <textarea
            className={styles.descInput}
            value={description}
            onChange={e => onChange(notes, e.target.value)}
            placeholder="例: 最初はジャスミンのような甘さ、後からウッドのような落ち着いた香りが続く…"
            rows={3}
          />
        )}
      </div>
    </div>
  )
}
