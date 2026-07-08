-- =============================================
-- TeaNote v16 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① 不要なスコアカラムを削除（score_taste, score_color）
alter table public.reviews
  drop column if exists score_taste,
  drop column if exists score_color;

-- ② スケールを1〜10 → 1〜5 に変更（CHECK制約を更新）
alter table public.reviews
  drop constraint if exists reviews_score_aroma_check,
  drop constraint if exists reviews_score_astringency_check,
  drop constraint if exists reviews_score_sweetness_check,
  drop constraint if exists reviews_score_richness_check;

alter table public.reviews
  add constraint reviews_score_aroma_check        check (score_aroma between 1 and 5),
  add constraint reviews_score_astringency_check  check (score_astringency between 1 and 5),
  add constraint reviews_score_sweetness_check    check (score_sweetness between 1 and 5),
  add constraint reviews_score_richness_check     check (score_richness between 1 and 5);

-- ③ 既存データのスケールを変換（10段階 → 5段階）
update public.reviews
set
  score_aroma       = greatest(1, least(5, ceil(score_aroma / 2.0)::int)),
  score_astringency = greatest(1, least(5, ceil(score_astringency / 2.0)::int)),
  score_sweetness   = greatest(1, least(5, ceil(score_sweetness / 2.0)::int)),
  score_richness    = greatest(1, least(5, ceil(score_richness / 2.0)::int));
