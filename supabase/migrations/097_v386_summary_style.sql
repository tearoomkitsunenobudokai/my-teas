-- =============================================
-- My-Teas v386 マイグレーション
-- AI要約を「文体ごとに列を持つ」形から「1本＋使った設定を保存する」形に変える。
-- Supabase SQL Editor で実行してください。
--
-- 既存の summary_normal / summary_ojou は削除しません。
-- 万一の切り戻しに備えて残し、新しい列へコピーするだけにしています。
-- 問題がないことを確認できたら、後日あらためて削除してください。
-- =============================================

alter table public.reviews
  add column if not exists summary_text   text,
  add column if not exists summary_tone   text,
  add column if not exists summary_length text;

-- 既存データの引き継ぎ。
-- 通常の要約があればそれを優先し、無ければお嬢様風を移す。
-- 旧「通常」は、ですます調で書かれていたため desumasu 扱いとする。
update public.reviews
set summary_text   = summary_normal,
    summary_tone   = 'desumasu',
    summary_length = 'normal'
where summary_text is null
  and summary_normal is not null
  and length(trim(summary_normal)) > 0;

update public.reviews
set summary_text   = summary_ojou,
    summary_tone   = 'ojou',
    summary_length = 'normal'
where summary_text is null
  and summary_ojou is not null
  and length(trim(summary_ojou)) > 0;

-- 想定外の値が入らないようにする
alter table public.reviews
  drop constraint if exists reviews_summary_tone_check;
alter table public.reviews
  add constraint reviews_summary_tone_check
  check (summary_tone is null or summary_tone in ('desumasu', 'dearu', 'ojou'));

alter table public.reviews
  drop constraint if exists reviews_summary_length_check;
alter table public.reviews
  add constraint reviews_summary_length_check
  check (summary_length is null or summary_length in ('short', 'normal', 'long'));

comment on column public.reviews.summary_text is
  'AI要約の本文。summary_normal / summary_ojou を統合したもの（v386〜）';
comment on column public.reviews.summary_tone is
  '要約を生成したときの語尾・文体（desumasu / dearu / ojou）';
comment on column public.reviews.summary_length is
  '要約を生成したときの長さ（short / normal / long）';
