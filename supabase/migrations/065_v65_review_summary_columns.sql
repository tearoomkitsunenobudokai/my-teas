-- =============================================
-- TeaNote v65 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 評価のAI要約（通常/お嬢様風）を保存できるようにする。
-- 背景: ポイントを消費して生成する機能のため、生成結果は保存され、
--       ページ再訪問・再ログイン後も表示されている必要がある。
--       これまでは画面上のstateのみで、リロードすると消えていた。

alter table public.reviews
  add column if not exists summary_normal text,
  add column if not exists summary_ojou text;

comment on column public.reviews.summary_normal is 'AI要約（通常トーン）。ポイント消費して生成・保存。再生成時は上書き。';
comment on column public.reviews.summary_ojou is 'AI要約（お嬢様風トーン）。ポイント消費して生成・保存。再生成時は上書き。';
