/**
 * 都道府県を「都道府県コード順」（北海道=1 … 沖縄県=47）で扱うためのヘルパー。
 * 文字コード順に並べると「三重県・京都府・兵庫県…」のように
 * 地理と無関係な並びになってしまうため、こちらを使って並べ替える。
 */

export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県',
] as const

/**
 * 表記ゆれを吸収して都道府県コード（1〜47）を返す。
 * 「大阪」「大阪府」のように末尾の都道府県が省略された値も同じ順序になる。
 * 該当しない値（自由入力など）は 999 を返し、末尾へ送る。
 */
export function prefectureOrder(name?: string | null): number {
  const n = (name ?? '').trim()
  if (!n) return 999
  const exact = PREFECTURES.indexOf(n as typeof PREFECTURES[number])
  if (exact >= 0) return exact + 1
  // 「大阪」→「大阪府」のように、末尾の「都/道/府/県」が無い表記に対応する
  const loose = PREFECTURES.findIndex(p => p.replace(/[都道府県]$/, '') === n.replace(/[都道府県]$/, ''))
  return loose >= 0 ? loose + 1 : 999
}

/** 都道府県名の配列を、都道府県コード順に並べ替えて返す */
export function sortByPrefecture(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const d = prefectureOrder(a) - prefectureOrder(b)
    // どちらも一覧に無い値どうしは、名前順で安定させる
    return d !== 0 ? d : a.localeCompare(b, 'ja')
  })
}
