-- =============================================
-- TeaNote v4 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① reviews に「飲んだ日」を追加
alter table public.reviews
  add column if not exists drank_at date default current_date;

-- ② reviews の unique(user_id, tea_id) 制約を削除
--    （同じ茶葉を複数回評価できるようにする）
alter table public.reviews
  drop constraint if exists reviews_user_id_tea_id_key;

-- ③ teas に「おすすめ添え物」を追加（JSON配列で保存）
alter table public.teas
  add column if not exists accompaniments jsonb default '[]'::jsonb,
  add column if not exists accompaniment_note text;  -- 「その他」の自由記入

-- 既存データに drank_at を設定（created_at の日付を使用）
update public.reviews
  set drank_at = created_at::date
  where drank_at is null;
