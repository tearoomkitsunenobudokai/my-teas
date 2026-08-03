/**
 * カラーパレット関連の共通定義。
 * 色の登録は「カラーパレット画面」と「写真から水色を取り込むモーダル」の
 * 2か所から行えるため、上限やカテゴリ判定はここに集約する。
 */

/* 個人で登録できる色の上限は、管理者メニュー（plan_limits の 'colors'）で
   権限区分ごとに変更できるため、ここには定数を置かない。
   利用側で supabase.rpc('get_my_limit', { p_feature: 'colors' }) を呼ぶこと。
   （戻り値 0 は「無制限」を表す） */

/** 色名の最大文字数 */
export const MAX_COLOR_NAME = 20

export const CAT_ORDER = ['red', 'orange', 'yellow', 'green', 'brown', 'clear', 'other'] as const

/**
 * 色コードを比較用に正規化する。
 * 「#c8a96e」「#C8A96E」「#C8A96EB0」のような表記ゆれ・透明度の違いを吸収し、
 * 同じ色かどうかを判定できるようにする（透明度は色そのものではないため無視する）。
 */
export function normalizeHex6(hex?: string | null): string {
  let h = (hex ?? '').trim().replace('#', '')
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('')
  return h.slice(0, 6).toUpperCase()
}

/**
 * 登録済みの色の中に、同じ色がすでにあるかを探す。
 * 見つかった場合はその色を返す（警告の文言に名前を使うため）。
 * excludeId を渡すと、その色自身は対象から除く（編集時に使う）。
 */
export function findDuplicateColor(
  colors: { id?: string; name?: string; hex?: string }[],
  hex: string,
  excludeId?: string,
): { id?: string; name?: string; hex?: string } | undefined {
  const target = normalizeHex6(hex)
  if (!target) return undefined
  return colors.find(c => c.id !== excludeId && normalizeHex6(c.hex) === target)
}

/**
 * 色から、おおよそのカテゴリを自動判定する。
 * 写真から取り込んだ色は利用者がカテゴリを選ばずに登録できるようにするため、
 * 色相（Hue）と彩度・明度から機械的に振り分ける。
 */
export function detectCategory(hex6: string): string {
  const h = hex6.replace('#', '')
  if (h.length < 6) return 'other'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max                       // 明度
  const s = max === 0 ? 0 : d / max   // 彩度

  // ほぼ無彩色で明るいものは「透明・無色」扱い
  if (s < 0.12 && v > 0.85) return 'clear'
  if (s < 0.08) return 'other'

  // 色相を求める（0〜360度）
  let hue = 0
  if (d !== 0) {
    if (max === r)      hue = 60 * (((g - b) / d) % 6)
    else if (max === g) hue = 60 * ((b - r) / d + 2)
    else                hue = 60 * ((r - g) / d + 4)
  }
  if (hue < 0) hue += 360

  // 暗く彩度が低めの橙〜黄は褐色に寄せる（紅茶は褐色帯が多いため）
  if (hue >= 15 && hue < 50 && v < 0.55) return 'brown'
  if (hue < 15 || hue >= 345) return 'red'
  if (hue < 45)  return 'orange'
  if (hue < 70)  return 'yellow'
  if (hue < 170) return 'green'
  if (hue < 345) return 'other'   // 青〜紫は紅茶では稀
  return 'other'
}
