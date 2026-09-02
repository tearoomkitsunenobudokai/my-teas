// ─────────────────────────────────────────────────────────
// ログインスタンプの絵柄。
//
// 絵柄はサーバー側（record_login_and_grant_v3）で抽選し、profiles に保存される。
// クライアントで抽選すると、当たりが出るまで引き直せてしまうため。
//
// ここでは「キー → 画像とラベル」の対応だけを持つ。
// キーの一覧は supabase/migrations/101 の stamp_icon_keys() と対応させること。
// ─────────────────────────────────────────────────────────

export type StampIcon = { key: string; src: string; label: string }

/**
 * 絵柄の全候補。
 *
 * 次の3つは意図的に外している。
 *   ・none（×印）      … 「なし」を意味するので、集める絵柄に向かない
 *   ・unknown（？印）  … 同上
 *   ・no-data          … 空欄用の飾りで、押した印には見えない
 */
export const STAMP_ICONS: StampIcon[] = [
  { key: 'leaf',    src: '/icons/brew/leaf.png',            label: 'リーフ' },
  { key: 'milk',    src: '/icons/accompaniments/milk.png',  label: 'ミルク' },
  { key: 'teabag',  src: '/icons/brew/teabag.png',          label: 'ティーバッグ' },
  { key: 'sugar',   src: '/icons/accompaniments/sugar.png', label: '砂糖' },
  { key: 'pot',     src: '/icons/brew/pot.png',             label: '手鍋' },
  { key: 'lemon',   src: '/icons/accompaniments/lemon.png', label: 'レモン' },
  { key: 'powder',  src: '/icons/brew/powder.png',          label: '粉末' },
  { key: 'honey',   src: '/icons/accompaniments/honey.png', label: '蜂蜜' },
  { key: 'diluted', src: '/icons/brew/diluted.png',         label: '希釈液' },
  { key: 'ice',     src: '/icons/accompaniments/ice.png',   label: 'アイス' },
]

const BY_KEY = new Map(STAMP_ICONS.map(i => [i.key, i]))

/**
 * キーから絵柄を引く。
 * 見つからない場合（マイグレーション適用前の古いデータなど）は、
 * 位置から決める従来の並びにそのまま落とす。
 */
export function stampIcon(key: string | undefined | null, fallbackIndex = 0): StampIcon {
  return (key && BY_KEY.get(key)) || STAMP_ICONS[fallbackIndex % STAMP_ICONS.length]
}

/** 引いた絵柄が分からないときの、位置から決める並び */
export function stampIconAt(index: number): StampIcon {
  return STAMP_ICONS[index % STAMP_ICONS.length]
}
