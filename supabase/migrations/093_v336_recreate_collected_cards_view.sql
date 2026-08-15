-- =============================================
-- My-Teas v336 マイグレーション
-- my_collected_cards ビューを作り直す（092 の修正版）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 092 が失敗した理由:
--   create or replace view は、既存のビューと「列の名前・順序・型」が
--   一致していないと実行できない。
--   092 では color_hex の直後に color_name を差し込んだため、
--   それ以降の列がすべて1つずつずれ、名前の変更とみなされて拒否された。
--
--   列を追加するときは、いったん drop してから作り直す必要がある。
--   （末尾に追加する場合も、安全のため同じ手順にしておく）
--
-- ビューは実データを持たないため、削除しても評価や収集の記録は失われない。

drop view if exists public.my_collected_cards;

create view public.my_collected_cards
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
