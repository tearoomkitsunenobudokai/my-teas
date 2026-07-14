// ─────────────────────────────────────────────────────────
// 抽出方法・添え物のアイコン画像パス解決
//
// 画像はDBに登録する必要はなく、決まったファイル名で
// /public/icons/brew/ または /public/icons/accompaniments/ に
// 置くだけで自動的に使われる（コード修正不要）。
//
// 対応済みのファイル名（.png推奨、背景透過で正方形に近いものが綺麗に収まる）:
//   /public/icons/brew/leaf.png      … リーフ
//   /public/icons/brew/teabag.png    … ティーバッグ
//   /public/icons/brew/pot.png       … 手鍋
//   /public/icons/brew/powder.png    … 粉末
//   /public/icons/brew/diluted.png   … 希釈液
//   /public/icons/brew/unknown.png   … 不明
//
//   /public/icons/accompaniments/none.png    … なし（ストレート）
//   /public/icons/accompaniments/honey.png   … 蜂蜜
//   /public/icons/accompaniments/milk.png    … ミルク
//   /public/icons/accompaniments/sugar.png   … 砂糖
//   /public/icons/accompaniments/lemon.png   … レモン
//   /public/icons/accompaniments/ice.png     … アイス（グラス）
//
// 画像が無い（404になる）場合は、これまで通り文字チップ表示にフォールバックする。
// ─────────────────────────────────────────────────────────

export const BREW_ICON_KEYS: Record<string, string> = {
  'リーフ': 'leaf',
  'ティーバッグ': 'teabag',
  '手鍋': 'pot',
  '粉末': 'powder',
  '希釈液': 'diluted',
  '不明': 'unknown',
}

export const ACCOMPANIMENT_ICON_KEYS: Record<string, string> = {
  'なし（ストレート）': 'none',
  '蜂蜜': 'honey',
  'ミルク': 'milk',
  '砂糖': 'sugar',
  'レモン': 'lemon',
  'アイス（グラス）': 'ice',
}

export function brewIconPath(label: string): string | null {
  const key = BREW_ICON_KEYS[label]
  return key ? `/icons/brew/${key}.png` : null
}

export function accompanimentIconPath(label: string): string | null {
  const key = ACCOMPANIMENT_ICON_KEYS[label]
  return key ? `/icons/accompaniments/${key}.png` : null
}
