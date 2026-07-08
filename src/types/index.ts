export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  is_admin: boolean
  is_creator: boolean
  points: number
  account_status?: 'normal' | 'write_restricted' | 'login_disabled'
  created_at: string
}

export interface Review {
  id: string
  user_id: string
  tea_name: string
  brand_name?: string | null
  shop_name?: string | null
  score_aroma: number       // 香り  1(弱)〜5(強)
  score_astringency: number // 渋み  1(弱)〜5(強)
  score_richness: number    // コク  1(少ない)〜5(多い)
  score_sweetness: number   // 甘味  1(弱)〜5(強)
  comment: string | null
  is_public: boolean
  drank_at: string | null
  created_at: string
  profiles?: { name: string } | null
}

export interface ReviewScores {
  score_aroma: number
  score_astringency: number
  score_richness: number
  score_sweetness: number
}

export const SCORE_LABELS: Record<keyof ReviewScores, string> = {
  score_aroma:       '香り',
  score_astringency: '渋み',
  score_richness:    'コク',
  score_sweetness:   '甘味',
}

export const SCORE_DESCRIPTIONS: Record<keyof ReviewScores, { weak: string; strong: string; note?: string }> = {
  score_aroma:       { weak: '弱', strong: '強' },
  score_astringency: { weak: '弱', strong: '強' },
  score_richness:    { weak: '少', strong: '多' },
  score_sweetness:   { weak: '弱', strong: '強', note: 'ストレートで飲んだときの、茶葉本来の甘味（砂糖などの甘みではありません）' },
}

// 香り分析のプリセット
// 三井農林「紅茶キャラクターホイール」の9系統構造を参考に構成
// 出典: https://www.ochalabo.com/taste/taste20141205.html
export const AROMA_PRESETS = [
  {
    group: 'Green（グリーン）',
    items: ['若草','青葉','青草','きゅうり','ピーマン','えんどう豆','ほうれん草','海苔','わかめ'],
  },
  {
    group: 'Woody（ウッディ）',
    items: ['ごぼう','木材','杉','土','苔','革','煙','セロリ','根菜'],
  },
  {
    group: 'Floral（フローラル）',
    items: ['スズラン','バラ','ジャスミン','金木犀','ライラック','スミレ','カモミール','菊','梅の花'],
  },
  {
    group: 'Fruity - Fresh（生の果実）',
    items: ['マスカット','青りんご','レモン','グレープフルーツ','ライム','柑橘','梨','メロン'],
  },
  {
    group: 'Fruity - Sweet（甘い果実）',
    items: ['アプリコット','ピーチ','マンゴー','パッションフルーツ','ライチ','パイナップル','バナナ','いちじく'],
  },
  {
    group: 'Fruity - Processed（加工果実）',
    items: ['干しぶどう','プルーン','レーズン','ドライアプリコット','干しいちじく','フルーツケーキ','ジャム'],
  },
  {
    group: 'Sweet（スウィート）',
    items: ['スイートポテト','黒砂糖','はちみつ','キャラメル','バニラ','メープルシロップ','チョコレート','和三盆'],
  },
  {
    group: 'Roast（ロースト）',
    items: ['麦茶','ほうじ茶','玄米','コーヒー','ナッツ','カカオ','焦げ','スモーク','パン'],
  },
  {
    group: 'Spicy（スパイシー）',
    items: ['湿布薬','シナモン','クローブ','カルダモン','ミント','ユーカリ','しょうが','胡椒','ハーブ'],
  },
]
