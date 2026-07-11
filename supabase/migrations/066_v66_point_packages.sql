-- =============================================
-- TeaNote v66 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ポイント購入プランを製作者が管理画面から金額・ポイント数を設定できるようにする。
-- これまでは points/page.tsx にハードコードされた3プラン（お試し/お得/まとめ買い）
-- のみだった。ここに「期間限定オファー」を含む可変数のプランをDBで管理する。

create table if not exists public.point_packages (
  id uuid primary key default gen_random_uuid(),
  label text not null,               -- 表示名（例: お試し、期間限定！）
  points int not null check (points > 0),
  price_yen int not null check (price_yen >= 0),
  sort_order int not null default 0,
  is_limited boolean not null default false,   -- 期間限定オファーかどうか
  limited_until timestamptz,                    -- 期間限定の場合の終了日時（NULL=無期限）
  is_active boolean not null default true,      -- falseにすると非表示（削除せず一時停止）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.point_packages enable row level security;

-- 閲覧: ログインユーザーなら誰でも（購入ページに表示するため）
drop policy if exists "point_packages_select" on public.point_packages;
create policy "point_packages_select" on public.point_packages
  for select using (auth.role() = 'authenticated');

-- 追加・変更・削除: 管理者・製作者のみ
drop policy if exists "point_packages_write" on public.point_packages;
create policy "point_packages_write" on public.point_packages
  for all using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- 初期データ：既存の3プラン + 期間限定オファーのひな形（製作者が金額等を編集してください）
insert into public.point_packages (label, points, price_yen, sort_order, is_limited, limited_until, is_active)
select * from (values
  ('お試し',       2,  100,  1, false, null::timestamptz, true),
  ('お得',         10, 450,  2, false, null::timestamptz, true),
  ('まとめ買い',   30, 1200, 3, false, null::timestamptz, true),
  ('期間限定！',   20, 500,  4, true,  now() + interval '30 days', true)
) as seed(label, points, price_yen, sort_order, is_limited, limited_until, is_active)
where not exists (select 1 from public.point_packages);

create index if not exists idx_point_packages_sort on public.point_packages(sort_order);
