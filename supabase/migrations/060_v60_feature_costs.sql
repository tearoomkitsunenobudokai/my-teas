-- =============================================
-- TeaNote v60 マイグレーション（AI機能のポイント消費数を設定化）
-- Supabase SQL Editor で実行してください
-- =============================================
-- AIティーアドバイザー・オススメ・要約などの消費ポイント数を
-- 管理画面から変更できるようにする。変更は製作者のみ。
-- 項目を増やす場合は feature_costs に行を追加するだけでよい。

create table if not exists public.feature_costs (
  feature text primary key,          -- 'advisor' | 'recommend' | 'summary' | 'summary_ojou'
  cost int not null default 0,       -- 消費ポイント数（0 = 無料）
  label text not null,               -- 管理画面での表示名
  sort_order int not null default 0, -- 表示順
  updated_at timestamptz not null default now()
);

alter table public.feature_costs enable row level security;

-- 閲覧は全員（各機能ページが自分のコストを読む必要があるため）
create policy "feature_costs_select_all" on public.feature_costs for select using (true);
-- 変更は製作者のみ
create policy "feature_costs_creator_write" on public.feature_costs
  for all using (public.is_current_user_creator()) with check (public.is_current_user_creator());

-- 初期値（現行の直書きコストに合わせる）
insert into public.feature_costs (feature, cost, label, sort_order) values
  ('advisor',      2, 'AIティーアドバイザー', 1),
  ('recommend',    1, 'オススメの1杯',        2),
  ('summary',      1, '評価のAI要約（通常）',  3),
  ('summary_ojou', 1, '評価のAI要約（お嬢様風）', 4)
on conflict (feature) do nothing;

-- 現在のユーザー向けに、指定機能の消費コストを返す関数
create or replace function public.get_feature_cost(p_feature text)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce((select cost from public.feature_costs where feature = p_feature), 0);
$$;

grant execute on function public.get_feature_cost(text) to authenticated;
