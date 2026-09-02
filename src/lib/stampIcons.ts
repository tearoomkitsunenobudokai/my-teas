// ─────────────────────────────────────────────────────────
// ログインスタンプの絵柄。
//
// 絵柄はDBに保存せず、「何個目か」だけから決めている（純粋な関数）。
// そのため画面を開き直しても、昨日押したスタンプの絵柄は変わらない。
// ランダムにすると再描画のたびに絵が変わり、「押した記録」に見えなくなるため。
//
// 絵柄は /public/icons/ にある淹れ方・添え物のアイコンを流用している。
// 追加・並べ替えは STAMP_ICONS をいじるだけでよい。
// ─────────────────────────────────────────────────────────

export type StampIcon = { src: string; label: string }

/**
 * スタンプに使う絵柄の並び。
 *
 * 淹れ方と添え物を交互に置いて、単調にならないようにしている。
 * 次の3つは意図的に外している。
 *   ・none（×印）      … 「なし」を意味するので、集める絵柄に向かない
 *   ・unknown（？印）  … 同上
 *   ・no-data          … 空欄用の飾りで、押した印には見えない
 */
export const STAMP_ICONS: StampIcon[] = [
  { src: '/icons/brew/leaf.png',            label: 'リーフ' },
  { src: '/icons/accompaniments/milk.png',  label: 'ミルク' },
  { src: '/icons/brew/teabag.png',          label: 'ティーバッグ' },
  { src: '/icons/accompaniments/sugar.png', label: '砂糖' },
  { src: '/icons/brew/pot.png',             label: '手鍋' },
  { src: '/icons/accompaniments/lemon.png', label: 'レモン' },
  { src: '/icons/brew/powder.png',          label: '粉末' },
  { src: '/icons/accompaniments/honey.png', label: '蜂蜜' },
  { src: '/icons/brew/diluted.png',         label: '希釈液' },
  { src: '/icons/accompaniments/ice.png',   label: 'アイス' },
]

/**
 * 何個目のマスかから絵柄を決める（0始まり）。
 * 必要日数が絵柄の数より多い場合は、先頭に戻って繰り返す。
 */
export function stampIconAt(index: number): StampIcon {
  return STAMP_ICONS[index % STAMP_ICONS.length]
}
