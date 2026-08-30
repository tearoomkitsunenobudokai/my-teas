-- =============================================
-- My-Teas v388 マイグレーション
-- AI要約を直近2件まで残せるようにする。
--   summary_text      … 最新
--   summary_prev_text … ひとつ前
-- 生成のたびに「最新 → ひとつ前」へ送り、新しいものを最新に入れる。
-- Supabase SQL Editor で実行してください。
-- =============================================

alter table public.reviews
  add column if not exists summary_prev_text   text,
  add column if not exists summary_prev_tone   text,
  add column if not exists summary_prev_length text,
  add column if not exists summary_at          timestamptz,
  add column if not exists summary_prev_at     timestamptz;

-- 想定外の値が入らないようにする（最新側と同じ制約）
alter table public.reviews
  drop constraint if exists reviews_summary_prev_tone_check;
alter table public.reviews
  add constraint reviews_summary_prev_tone_check
  check (summary_prev_tone is null or summary_prev_tone in ('desumasu', 'dearu', 'ojou'));

alter table public.reviews
  drop constraint if exists reviews_summary_prev_length_check;
alter table public.reviews
  add constraint reviews_summary_prev_length_check
  check (summary_prev_length is null or summary_prev_length in ('short', 'normal', 'long'));

-- 既にある要約には生成日時が無いため、評価の作成日時で埋めておく。
-- （画面では「いつ作ったか」の目安としてのみ使う）
update public.reviews
set summary_at = coalesce(summary_at, created_at)
where summary_text is not null and summary_at is null;

comment on column public.reviews.summary_prev_text is
  'ひとつ前のAI要約。生成のたびに summary_text から送られてくる（v388〜）';
comment on column public.reviews.summary_at is
  '最新のAI要約を生成した日時';
comment on column public.reviews.summary_prev_at is
  'ひとつ前のAI要約を生成した日時';
