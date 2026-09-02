-- =============================================
-- My-Teas v389 マイグレーション
-- AI要約の片方をロックして、作り直しても消えないようにする。
--   'latest' … ①（summary_text 側）を保護
--   'prev'   … ②（summary_prev_text 側）を保護
--   null     … ロックなし
-- 同時にロックできるのは片方だけなので、真偽値2つではなく1列で持つ。
-- Supabase SQL Editor で実行してください。
-- =============================================

alter table public.reviews
  add column if not exists summary_locked text;

alter table public.reviews
  drop constraint if exists reviews_summary_locked_check;
alter table public.reviews
  add constraint reviews_summary_locked_check
  check (summary_locked is null or summary_locked in ('latest', 'prev'));

comment on column public.reviews.summary_locked is
  'ロック中のAI要約。latest=①を保護 / prev=②を保護 / null=保護なし（v389〜）';
