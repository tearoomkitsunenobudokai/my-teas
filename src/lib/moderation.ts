// ─────────────────────────────────────────────────────────
// コメントモデレーション（プロトタイプ版）
//
// 現状はNGワードのローカル辞書によるチェック（方式B・無料・API不要）。
// 将来的に外部AI API（例: Anthropic API）へ差し替える際は、
// isCommentClean() の中身を fetch('/api/moderate', ...) のような
// 非同期のAPI呼び出しに変えるだけで、呼び出し側の考え方は変わらない。
// （その場合は関数を async にして呼び出し側で await する）
//
// 判定に使うNGワードは、DB側のトリガー（migration 051）と同じ内容に揃えること。
// クライアントだけでは改竄でバイパスできるため、DBトリガーでも同じ検査をして
// is_public を強制的に false にする二重防御にしている。
// ─────────────────────────────────────────────────────────

// 明らかに不適切とみなす語（誹謗中傷・差別・露骨な表現など）。
// 実運用に合わせて随時追加してください。ここでは代表例のみ記載。
const NG_WORDS: string[] = [
  '死ね', '殺す', 'しね', 'ころす',
  'キチガイ', 'きちがい', 'バカ野郎', 'クズ',
  'ブス', 'デブ', 'ハゲ',
  // 差別・侮蔑を意図する語や露骨な性的表現などは運用に応じて追加
]

// コメントが公開してよい内容か判定する。
// 戻り値 clean=false のとき、公開（is_public=true）にはできない。
export function isCommentClean(comment: string | null | undefined): { clean: boolean; reason?: string } {
  return isTextClean(comment)
}

// 任意のテキストにNGワードが含まれていないか判定する汎用関数。
export function isTextClean(text: string | null | undefined): { clean: boolean; word?: string; reason?: string } {
  if (!text) return { clean: true }
  const normalized = text.replace(/\s/g, '')
  for (const w of NG_WORDS) {
    if (normalized.includes(w)) {
      return { clean: false, word: w, reason: '不適切な表現が含まれている可能性があります' }
    }
  }
  return { clean: true }
}

// プロフィールの複数項目をまとめて検査する。
// 1つでもNGがあれば clean=false と、どの項目かを返す（登録を止める用途）。
export function checkProfileFields(fields: { label: string; value: string | null | undefined }[]):
  { clean: boolean; label?: string } {
  for (const f of fields) {
    const r = isTextClean(f.value)
    if (!r.clean) return { clean: false, label: f.label }
  }
  return { clean: true }
}
