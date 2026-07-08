-- =============================================
-- TeaNote v17 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 問題: teas テーブルの UPDATE ポリシーが
--   「作成者 or 管理者」のみ許可しているため、
--   公式茶葉（created_by = NULL）の aroma_notes を
--   一般ユーザーが更新できない。
--
-- 解決: aroma_notes / aroma_description は
--   ログイン済みユーザーなら誰でも自分の評価として
--   更新できるように、専用のポリシーを追加する。

-- 既存の teas update ポリシーを確認・再作成
drop policy if exists "teas_update" on public.teas;
drop policy if exists "teas_update_aroma" on public.teas;

-- 通常の更新（名前・説明等）：作成者 or 管理者のみ
create policy "teas_update" on public.teas for update using (
  auth.uid() = created_by or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- 香り分析のみの更新：ログイン済みユーザーなら誰でも可
-- （WITH CHECK で aroma_notes / aroma_description 以外の変更は弾く）
-- ※ Supabase の RLS は列レベルでは制御できないため、
--    アプリ側で aroma_notes/aroma_description のみ送るよう制御している前提

-- 実用的な解決策：teas の aroma_notes/aroma_description を
-- 別テーブル（tea_aroma_data）に分離する
-- ↓ こちらを使う場合は以下を実行

create table if not exists public.tea_aroma_data (
  tea_id uuid references public.teas(id) on delete cascade primary key,
  aroma_notes text[] default '{}',
  aroma_description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

alter table public.tea_aroma_data enable row level security;

-- 全ユーザーが読み取り可能
create policy "tea_aroma_select" on public.tea_aroma_data
  for select using (true);

-- ログイン済みユーザーなら誰でも insert/update 可能
create policy "tea_aroma_insert" on public.tea_aroma_data
  for insert with check (auth.uid() is not null);

create policy "tea_aroma_update" on public.tea_aroma_data
  for update using (auth.uid() is not null);

-- 既存の teas.aroma_notes データを移行
insert into public.tea_aroma_data (tea_id, aroma_notes, aroma_description)
select id, coalesce(aroma_notes, '{}'), aroma_description
from public.teas
where aroma_notes is not null or aroma_description is not null
on conflict (tea_id) do nothing;
