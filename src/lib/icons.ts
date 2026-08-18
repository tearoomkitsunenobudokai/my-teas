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

import { APP_VERSION } from './version'

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

/** 淹れ方が「不明」で茶葉量・水量・時間も無いとき、空いた場所に置く飾り画像。
    /public/icons/brew/no-data.png を置くだけで表示される（無ければ何も出ない）。 */
export const BREW_FILLER_ICON = '/icons/brew/no-data.png'

/** 添え物の並び順（入力フォーム・評価カードで共通）。
    カードは3列×2行のマスに、この順で必ず6つとも表示する。 */
export const ACCOMPANIMENT_ORDER = [
  'なし（ストレート）', 'ミルク', '砂糖',
  '蜂蜜', 'レモン', 'アイス（グラス）',
] as const

/** 評価カードの狭いマスに入れるための短縮名。括弧書きを落とすだけ。
    定義が無いものはそのままの表記を使う。 */
export const ACCOMPANIMENT_SHORT_LABELS: Record<string, string> = {
  'なし（ストレート）': 'ストレート',
  'アイス（グラス）': 'アイス',
}

export function accompanimentShortLabel(label: string): string {
  return ACCOMPANIMENT_SHORT_LABELS[label] ?? label
}

/* アイコンの見た目を差し替えたとき、ファイル名が同じだと
   ブラウザに残っている古い画像がそのまま使われ続ける。
   （画像は長くキャッシュされるため、再読み込みしても直らないことがある）
   アドレスの末尾にアプリのバージョンを付けておくと、
   バージョンが上がった時点で別のアドレス扱いになり、確実に新しい画像が読まれる。 */
const ICON_REV = `?v=${APP_VERSION}`

export function brewIconPath(label: string): string | null {
  const key = BREW_ICON_KEYS[label]
  return key ? `/icons/brew/${key}.png${ICON_REV}` : null
}

export function accompanimentIconPath(label: string): string | null {
  const key = ACCOMPANIMENT_ICON_KEYS[label]
  return key ? `/icons/accompaniments/${key}.png${ICON_REV}` : null
}
