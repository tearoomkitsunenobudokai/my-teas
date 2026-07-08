-- =============================================
-- TeaNote v5 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- profiles にプロフィール項目を追加
alter table public.profiles
  add column if not exists bio text,                          -- 自己紹介
  add column if not exists favorite_tea text,                 -- お気に入りの紅茶（自由記入）
  add column if not exists favorite_tea_id uuid references public.teas(id) on delete set null, -- お気に入りの紅茶（テーブル参照）
  add column if not exists location text,                     -- 居住地・活動地域
  add column if not exists certified_count integer default 0; -- 認定店制覇数（手動更新 or 自動集計）

-- 認定店制覇数を自動集計するビュー（参考用）
create or replace view public.profile_stats as
select
  p.id,
  p.name,
  p.bio,
  p.favorite_tea,
  p.location,
  count(distinct r.id) as review_count,
  count(distinct r.tea_id) as tea_count,
  count(distinct r.id) filter (where r.is_public = true) as public_review_count
from public.profiles p
left join public.reviews r on r.user_id = p.id
group by p.id, p.name, p.bio, p.favorite_tea, p.location;
