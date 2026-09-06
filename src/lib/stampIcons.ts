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

// ─── 役（ポーカー風） ─────────────────────────────────
// 判定はサーバー側（stamp_hand）で行い、ここでは見せ方だけを持つ。
// キーは supabase/migrations/102 の stamp_hand() と対応させること。

export type StampHand = 'five' | 'four' | 'full' | 'complete' | 'three' | 'twopair' | 'none'

export type HandInfo = {
  label: string
  note: string
  /** 演出の強さ。3=最大 */
  level: 0 | 1 | 2 | 3
}

export const HANDS: Record<StampHand, HandInfo> = {
  five:     { label: 'ファイブカード', note: '5つすべて同じ絵柄',   level: 3 },
  four:     { label: 'フォーカード',   note: '同じ絵柄が4つ',       level: 2 },
  complete: { label: 'コンプリート',   note: '5つすべてちがう絵柄', level: 2 },
  full:     { label: 'フルハウス',     note: '3つ＋2つのそろい',    level: 1 },
  three:    { label: 'スリーカード',   note: '同じ絵柄が3つ',       level: 1 },
  twopair:  { label: 'ツーペア',       note: '2つのペア',           level: 1 },
  none:     { label: '',               note: '',                     level: 0 },
}

export function handInfo(hand: string | undefined | null): HandInfo {
  return HANDS[(hand ?? 'none') as StampHand] ?? HANDS.none
}

/** 役を強い順に並べたもの（一覧表示に使う）。'none' は含めない。 */
export const HAND_ORDER: StampHand[] = ['five', 'four', 'complete', 'full', 'three', 'twopair']

/**
 * 役の見本。0〜4 は絵柄の種類を表す番号で、同じ番号なら同じ絵柄。
 * どのアイコンを当てるかは表示側で決める（STAMP_ICONS の先頭から順に使う）。
 */
export const HAND_SAMPLES: Record<StampHand, number[]> = {
  five:     [0, 0, 0, 0, 0],
  four:     [0, 0, 0, 0, 1],
  complete: [0, 1, 2, 3, 4],
  full:     [0, 0, 0, 1, 1],
  three:    [0, 0, 0, 1, 2],
  twopair:  [0, 0, 1, 1, 2],
  none:     [0, 1, 2, 3, 4],
}

/**
 * 役の出現率（%）。5マス・絵柄5種類のときの値。
 * supabase/migrations/102 のコメントと対応させること。
 */
export const HAND_ODDS: Record<StampHand, number> = {
  five: 0.16, four: 3.2, complete: 3.84, full: 6.4, three: 19.2, twopair: 28.8, none: 38.4,
}

/**
 * 1枚のスタンプカードで使う絵柄の種類数。
 *
 * 5で固定している。ログインボーナスが5日、マスが5つ、絵柄も5種類とそろえることで
 * 説明しやすくなるのに加え、5マス・5種類のときだけ6つの役がすべて成立するため。
 * 4種類以下にすると「コンプリート（全部ちがう）」が出せなくなる。
 *
 * サーバー側の既定値（app_settings の login_stamp_pool_size）と一致させること。
 */
export const STAMP_POOL_SIZE = 5

// ─── まだ成立しうる役の判定 ─────────────────────────────
//
// 「絵柄の個数の並び」から役を引くための表。5マス前提。
// 例: 同じ絵柄が3つ＋別が2つ → '3,2' → フルハウス。
// サーバー側の stamp_hand()（migrations/102）と同じ分け方にしている。
const HAND_BY_PATTERN: Record<string, StampHand> = {
  '5':         'five',
  '4,1':       'four',
  '3,2':       'full',
  '3,1,1':     'three',
  '2,2,1':     'twopair',
  '2,1,1,1':   'none',
  '1,1,1,1,1': 'complete',
}

/**
 * 引いた絵柄から、まだ成立する可能性が残っている役を求める。
 *
 * 残りの抽選の振り分けをすべて試し、たどり着ける並びを集めている。
 * マスは5つ・絵柄は多くても10種類なので、総当たりで十分間に合う。
 *
 * 判定に使うのは「どの絵柄が何個あるか」だけで、並び順は見ていない。
 * 役は並び順に関係なく決まるため。
 *
 * @param icons 引いた絵柄のキー（古い順）
 * @param need  マスの数
 * @param poolSize このカードで使う絵柄の種類数
 */
export function possibleHands(
  icons: string[],
  need: number,
  poolSize: number,
): Record<StampHand, boolean> {
  const result: Record<StampHand, boolean> = {
    five: false, four: false, complete: false,
    full: false, three: false, twopair: false, none: false,
  }

  const drawn = (icons ?? []).slice(0, need)
  const remain = Math.max(0, need - drawn.length)

  // 出た絵柄ごとの個数
  const counts = new Map<string, number>()
  for (const key of drawn) counts.set(key, (counts.get(key) ?? 0) + 1)
  const base = Array.from(counts.values())

  // まだ一度も出ていない絵柄のぶんの枠。ここに入れると新しい絵柄が増える。
  const unused = Math.max(0, poolSize - base.length)
  const slots = base.length + unused
  if (slots === 0) return result

  const add = new Array<number>(slots).fill(0)

  const walk = (i: number, left: number) => {
    if (i === slots) {
      if (left > 0) return
      const finals: number[] = []
      for (let j = 0; j < slots; j++) {
        const c = (j < base.length ? base[j] : 0) + add[j]
        if (c > 0) finals.push(c)
      }
      const hand = HAND_BY_PATTERN[finals.sort((a, b) => b - a).join(',')]
      if (hand) result[hand] = true
      return
    }
    for (let n = 0; n <= left; n++) {
      add[i] = n
      walk(i + 1, left - n)
    }
    add[i] = 0
  }
  walk(0, remain)

  return result
}
