// 評価のCSVエクスポート／インポート。
// エクスポートしたCSVをそのまま読み込めるよう、列の並びと見出しは
// EXPORT_HEADERS の1箇所だけで定義し、書き出しと取り込みの両方から参照する。
//
// 取り込みでは user_id を必ずログイン中の本人で上書きし、id は無視する
// （他人の評価やIDの偽装を防ぐため）。

import { AROMA_PRESETS } from '@/types'
import { ACCOMPANIMENT_ORDER } from './icons'
import { isTextClean, isCommentClean } from './moderation'

/** CSVの列定義（この順でエクスポートし、この見出しでインポートする） */
export const EXPORT_HEADERS = [
  '飲んだ日', '紅茶名', 'ブランド', '認定店', '原産国', '茶園',
  '水色コード', '水色の名前',
  '香り', '渋み', 'コク', '水色の濃さ',
  '香り分析',
  '抽出方法', '淹れ時間(秒)', '茶葉量(g)', '水量(ml)', '茶葉量(g/100ml)※旧',
  '添え物', 'コメント', 'その他の情報', '公開', '登録日時',
] as const

/** 入力欄と同じ上限（超える行は取り込まない） */
const LIMITS = {
  tea_name: 20, brand_name: 30, tea_garden: 20, origin_country: 20,
  color_name: 10, comment: 200, notes: 300, shop_name: 100,
}

const BREW_METHODS = ['リーフ', 'ティーバッグ', '手鍋', '粉末', '希釈液', '不明']
const AROMA_ALL = AROMA_PRESETS.flatMap(g => g.items)

export type ReviewRow = Record<string, any>

// ── エクスポート ──────────────────────────────
/** CSVの1セルを安全にエスケープ（カンマ・改行・引用符対応） */
function esc(v: any): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(reviews: ReviewRow[]): string {
  const rows = reviews.map(r => [
    r.drank_at ?? r.created_at?.slice(0, 10) ?? '',
    r.tea_name ?? '',
    r.brand_name ?? '',
    r.shop_name ?? '',
    r.origin_country ?? '',
    r.tea_garden ?? '',
    r.color_hex ?? '',
    r.color_name ?? '',
    r.score_aroma ?? '', r.score_astringency ?? '', r.score_richness ?? '', r.score_color_depth ?? '',
    Array.isArray(r.aroma_notes) ? r.aroma_notes.join('・') : '',
    r.brew_method ?? '',
    r.steep_seconds ?? '',
    r.tea_grams ?? '',
    r.water_ml ?? '',
    r.tea_grams_per_100ml ?? '',
    Array.isArray(r.accompaniments) ? r.accompaniments.join('・') : '',
    r.comment ?? '',
    r.notes ?? '',
    r.is_public ? '公開' : '非公開',
    r.created_at ?? '',
  ].map(esc).join(','))
  // Excelで文字化けしないよう BOM を付与
  return '\uFEFF' + [EXPORT_HEADERS.join(','), ...rows].join('\r\n')
}

// ── インポート ──────────────────────────────
/** 引用符・改行を含むセルに対応したCSVパーサ */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', inQuote = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuote) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ }   // 連続する引用符は1つの " として扱う
        else inQuote = false
      } else cell += c
    } else if (c === '"') inQuote = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\r') { /* 直後の \n で改行として処理する */ }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

export type ImportIssue = { line: number; reason: string }
export type ImportResult = {
  ok: ReviewRow[]          // 取り込める行
  skipped: ImportIssue[]   // 取り込まない行とその理由
}

const num = (v: string, min: number, max: number): number | null => {
  const n = Number(String(v).trim())
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

const splitList = (v: string): string[] =>
  String(v).split(/[・,、]/).map(s => s.trim()).filter(Boolean)

/**
 * CSVを評価データに変換する。
 * 1行でも不正があればその行だけ飛ばし、理由を skipped に積む
 * （全体を失敗させると、1文字の誤りで数百行が取り込めなくなるため）。
 */
export function parseReviewsCsv(text: string, userId: string): ImportResult {
  const rows = parseCsv(text)
  const ok: ReviewRow[] = []
  const skipped: ImportIssue[] = []
  if (!rows.length) return { ok, skipped: [{ line: 0, reason: 'ファイルが空です' }] }

  // 見出し行から列位置を引く（列の並び替えや列の増減に耐えるため）
  const head = rows[0].map(h => h.trim())
  const idx = (name: string) => head.indexOf(name)
  if (idx('紅茶名') < 0) {
    return { ok, skipped: [{ line: 1, reason: '見出し行に「紅茶名」がありません。エクスポートしたCSVをお使いください' }] }
  }
  const get = (r: string[], name: string) => {
    const i = idx(name)
    return i < 0 ? '' : (r[i] ?? '').trim()
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 1
    const bad = (reason: string) => skipped.push({ line, reason })

    const tea = get(r, '紅茶名')
    if (!tea) { bad('紅茶名が空です'); continue }

    // 文字数の上限
    const overs: string[] = []
    const cut = (name: string, key: keyof typeof LIMITS, label: string) => {
      const v = get(r, name)
      if (v.length > LIMITS[key]) overs.push(`${label}が${LIMITS[key]}文字を超えています`)
      return v
    }
    const brand = cut('ブランド', 'brand_name', 'ブランド')
    const garden = cut('茶園', 'tea_garden', '茶園')
    const origin = cut('原産国', 'origin_country', '原産国')
    const colorName = cut('水色の名前', 'color_name', '水色の名前')
    const comment = cut('コメント', 'comment', 'コメント')
    const notes = cut('その他の情報', 'notes', 'その他の情報')
    const shop = cut('認定店', 'shop_name', '認定店')
    if (tea.length > LIMITS.tea_name) overs.push(`紅茶名が${LIMITS.tea_name}文字を超えています`)
    if (overs.length) { bad(overs[0]); continue }

    // NGワード（画面から登録するときと同じ判定を通す）
    const ngTargets: [string, string][] = [
      ['紅茶名', tea], ['ブランド', brand], ['茶園', garden], ['水色の名前', colorName],
    ]
    let ng = ''
    for (const [label, v] of ngTargets) {
      if (v && !isTextClean(v).clean) { ng = `${label}に使用できない語が含まれています`; break }
    }
    if (!ng && comment && !isCommentClean(comment).clean) ng = 'コメントに使用できない語が含まれています'
    if (ng) { bad(ng); continue }

    // 日付（YYYY-MM-DD / YYYY/MM/DD を受け付ける）
    const rawDate = get(r, '飲んだ日').replace(/\//g, '-')
    let drankAt: string | null = null
    if (rawDate) {
      const m = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (!m) { bad('飲んだ日の形式が正しくありません（例: 2026-07-12）'); continue }
      const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
      if (Number.isNaN(Date.parse(d))) { bad('飲んだ日が実在しない日付です'); continue }
      drankAt = d
    }

    // スコアは1〜5。空欄は既定値3として扱う
    const sc = (name: string) => {
      const v = get(r, name)
      if (!v) return 3
      return num(v, 1, 5)
    }
    const sa = sc('香り'), ss = sc('渋み'), sr = sc('コク'), sd = sc('水色の濃さ')
    if (sa === null || ss === null || sr === null || sd === null) {
      bad('評価スコアは1〜5の数値で入力してください'); continue
    }

    // 水色（#RRGGBB / #RRGGBBAA のみ）
    const hexRaw = get(r, '水色コード')
    let hex: string | null = null
    if (hexRaw) {
      const h = hexRaw.startsWith('#') ? hexRaw : `#${hexRaw}`
      if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(h)) {
        bad('水色コードの形式が正しくありません（例: #B8442E）'); continue
      }
      hex = h.toUpperCase()
    }

    // 選択肢に無い値は捨てる（自由入力の香りは10文字までなら残す）
    const aroma = splitList(get(r, '香り分析'))
      .filter(a => AROMA_ALL.includes(a) || a.length <= 10)
      .filter(a => isTextClean(a).clean)
      .slice(0, 3)
    const acc = splitList(get(r, '添え物'))
      .filter(a => (ACCOMPANIMENT_ORDER as readonly string[]).includes(a))
    const brewRaw = get(r, '抽出方法')
    const brew = BREW_METHODS.includes(brewRaw) ? brewRaw : '不明'

    const opt = (name: string, min: number, max: number) => {
      const v = get(r, name)
      return v ? num(v, min, max) : null
    }

    ok.push({
      user_id: userId,
      tea_name: tea,
      brand_name: brand || null,
      shop_name: shop || null,
      tea_garden: garden || null,
      origin_country: origin || null,
      color_hex: hex,
      color_name: colorName || null,
      score_aroma: sa, score_astringency: ss, score_richness: sr, score_color_depth: sd,
      aroma_notes: aroma,
      brew_method: brew,
      steep_seconds: opt('淹れ時間(秒)', 0, 100000),
      tea_grams: opt('茶葉量(g)', 0, 1000),
      water_ml: opt('水量(ml)', 0, 100000),
      tea_grams_per_100ml: opt('茶葉量(g/100ml)※旧', 0, 1000),
      accompaniments: acc,
      comment: comment || null,
      notes: notes || null,
      is_public: get(r, '公開') === '公開',
      drank_at: drankAt,
    })
  }
  return { ok, skipped }
}

/** すでに同じ「飲んだ日＋紅茶名」がある行を除く（二重取り込みの防止） */
export function dropDuplicates(rows: ReviewRow[], existing: ReviewRow[]):
  { fresh: ReviewRow[]; dupCount: number } {
  const key = (r: ReviewRow) => `${r.drank_at ?? ''}\u0000${r.tea_name ?? ''}`
  const seen = new Set(existing.map(key))
  const fresh: ReviewRow[] = []
  let dupCount = 0
  for (const r of rows) {
    const k = key(r)
    if (seen.has(k)) { dupCount++; continue }
    seen.add(k)   // CSV内での重複も1件だけ取り込む
    fresh.push(r)
  }
  return { fresh, dupCount }
}
