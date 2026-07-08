-- =============================================
-- TeaNote v48 マイグレーション（認定店 正規化）
-- Supabase SQL Editor で実行してください
-- =============================================
-- これまで「1行 = 1店舗×1年度」だった certified_shops を、
-- 「店舗そのものの情報（マスター）」と「年度ごとの認定記録」に分割する。
--
-- certified_shop_masters : 店舗の恒久的な情報（名前・住所など。年度に依存しない）
-- certified_shop_years   : その店舗が「その年度に認定されていた」という記録
--                          （カテゴリは年度によって変わりうるためこちら側に持たせる）
--
-- 既存の certified_shops のデータ（全て2025年度）はそのまま移行し、
-- shop_bookmarks / shop_visits の参照も certified_shop_masters.id に張り替える。
-- 旧テーブルは certified_shops_legacy にリネームして当面残す（安全のため）。

-- ① 新テーブル作成
create table if not exists public.certified_shop_masters (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  prefecture text,
  area text,
  url text,
  note text,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.certified_shop_years (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.certified_shop_masters(id) on delete cascade,
  year int not null,
  category text not null default 'authentic' check (category in ('prestige', 'authentic', 'casual')),
  is_new boolean not null default false,
  is_award boolean not null default false,
  created_at timestamptz not null default now(),
  unique(shop_id, year)
);

alter table public.certified_shop_masters enable row level security;
alter table public.certified_shop_years enable row level security;

-- 閲覧は全員可、書き込みは管理者のみ（既存のcertified_shopsポリシーに準拠）
create policy "csm_select_all" on public.certified_shop_masters for select using (true);
create policy "csm_admin_insert" on public.certified_shop_masters for insert with check (public.is_current_user_admin());
create policy "csm_admin_update" on public.certified_shop_masters for update using (public.is_current_user_admin());
create policy "csm_admin_delete" on public.certified_shop_masters for delete using (public.is_current_user_admin());

create policy "csy_select_all" on public.certified_shop_years for select using (true);
create policy "csy_admin_insert" on public.certified_shop_years for insert with check (public.is_current_user_admin());
create policy "csy_admin_update" on public.certified_shop_years for update using (public.is_current_user_admin());
create policy "csy_admin_delete" on public.certified_shop_years for delete using (public.is_current_user_admin());

-- ② 既存データを移行（name + address をキーに店舗を一意化してマスター化）
insert into public.certified_shop_masters (name, address, prefecture, area, url, note, lat, lng, created_at)
select
  name,
  address,
  max(prefecture) as prefecture,
  max(area) as area,
  max(url) as url,
  max(note) as note,
  max(lat) as lat,
  max(lng) as lng,
  min(created_at) as created_at
from public.certified_shops
group by name, address;

insert into public.certified_shop_years (shop_id, year, category, is_new, is_award, created_at)
select m.id, cs.year, cs.category, cs.is_new, cs.is_award, cs.created_at
from public.certified_shops cs
join public.certified_shop_masters m
  on m.name = cs.name
  and m.address is not distinct from cs.address;

-- ③ shop_bookmarks / shop_visits の参照先を certified_shop_masters に張り替える
alter table public.shop_bookmarks add column new_shop_id uuid references public.certified_shop_masters(id) on delete cascade;
update public.shop_bookmarks b
set new_shop_id = m.id
from public.certified_shops cs
join public.certified_shop_masters m
  on m.name = cs.name and m.address is not distinct from cs.address
where b.shop_id = cs.id;

alter table public.shop_bookmarks drop column shop_id;
alter table public.shop_bookmarks rename column new_shop_id to shop_id;
alter table public.shop_bookmarks alter column shop_id set not null;
alter table public.shop_bookmarks add constraint shop_bookmarks_user_shop_unique unique(user_id, shop_id);

alter table public.shop_visits add column new_shop_id uuid references public.certified_shop_masters(id) on delete cascade;
update public.shop_visits v
set new_shop_id = m.id
from public.certified_shops cs
join public.certified_shop_masters m
  on m.name = cs.name and m.address is not distinct from cs.address
where v.shop_id = cs.id;

alter table public.shop_visits drop column shop_id;
alter table public.shop_visits rename column new_shop_id to shop_id;
alter table public.shop_visits alter column shop_id set not null;
alter table public.shop_visits add constraint shop_visits_user_shop_unique unique(user_id, shop_id);

-- ④ 旧テーブルは当面リネームして保持（データ移行の確認が済んだら手動でdropしてください）
--    drop table public.certified_shops_legacy;
alter table public.certified_shops rename to certified_shops_legacy;
