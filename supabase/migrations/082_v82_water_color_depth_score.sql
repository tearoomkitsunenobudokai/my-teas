-- =============================================
-- TeaNote v82 マイグレーション
--   「甘み」評価を廃止し、「水色の濃淡」評価を新設する
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 背景: ミルクティー等にした際、水色が濃いと色が残りやすいため、
--       「薄い(1) ↔ 濃い(5)」を新しい評価軸として追加する。
--       既存の色選択（color_hex / color_name）とは別物。
--
-- 甘み(score_sweetness)は完全に廃止する。列自体は削除せず残すが
-- （既存データの保全のため）、アプリ側では一切参照しない。

-- ① 新しい列を追加。過去データは中央値の3で埋める。
alter table public.reviews
  add column if not exists score_color_depth integer;

update public.reviews
  set score_color_depth = 3
  where score_color_depth is null;

alter table public.reviews
  alter column score_color_depth set default 3;

alter table public.reviews
  add constraint reviews_score_color_depth_check check (score_color_depth between 1 and 5);
