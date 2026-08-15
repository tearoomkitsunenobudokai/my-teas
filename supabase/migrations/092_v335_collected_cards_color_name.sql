-- =============================================
-- My-Teas v335 マイグレーション
-- 集めたカードのビューに色名（color_name）を追加
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 集めたカードの水色欄が、登録した色名ではなく常に「カスタム」と
-- 表示されていた問題の修正。
-- カード生成側は color_name を受け取れるようになっているが、
-- 一覧のもとになるこのビューが色名を返していなかった。

create or replace view public.my_collected_cards
with (security_invoker = true)
as
select
  c.id            as collection_id,
  c.collected_at,
  c.cost,
  r.id            as review_id,
  r.tea_name, r.brand_name, r.shop_name, r.tea_garden, r.origin_country,
  r.color_hex, r.color_name, r.aroma_notes, r.comment, r.drank_at,
  r.brew_method, r.steep_seconds, r.tea_grams_per_100ml, r.tea_grams, r.water_ml,
  r.accompaniments,
  r.score_aroma, r.score_astringency, r.score_richness, r.score_color_depth,
  r.user_id       as author_id,
  p.name          as author_name
from public.review_card_collections c
join public.reviews r on r.id = c.review_id
left join public.public_profiles p on p.id = r.user_id
where c.user_id = auth.uid();

grant select on public.my_collected_cards to authenticated;

notify pgrst, 'reload schema';
