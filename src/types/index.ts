export type TeaCategory = 'black' | 'green' | 'oolong' | 'white' | 'herbal'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface Tea {
  id: string
  name: string
  origin: string | null
  category: TeaCategory
  description: string | null
  is_official: boolean
  created_by: string | null
  created_at: string
  profiles?: { name: string } | null
}

export interface Review {
  id: string
  user_id: string
  tea_id: string
  score_aroma: number
  score_taste: number
  score_color: number
  score_astringency: number
  score_sweetness: number
  score_aftertaste: number
  comment: string | null
  is_public: boolean
  created_at: string
  profiles?: { name: string } | null
  teas?: { name: string; category: TeaCategory } | null
}

export interface ReviewScores {
  score_aroma: number
  score_taste: number
  score_color: number
  score_astringency: number
  score_sweetness: number
  score_aftertaste: number
}

export const SCORE_LABELS: Record<keyof ReviewScores, string> = {
  score_aroma: '香り',
  score_taste: '味',
  score_color: '色',
  score_astringency: '渋み',
  score_sweetness: '甘さ',
  score_aftertaste: '余韻',
}

export const CATEGORY_LABELS: Record<TeaCategory, string> = {
  black: '紅茶',
  green: '緑茶',
  oolong: '烏龍茶',
  white: '白茶',
  herbal: 'ハーブ',
}
