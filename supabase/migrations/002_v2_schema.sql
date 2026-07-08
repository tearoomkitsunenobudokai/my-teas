-- =============================================
-- TeaNote v2 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① 茶葉グループ
create table public.tea_groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  is_official boolean default false,   -- 管理者グループ=true
  created_at timestamptz default now()
);

-- ② teas にカラーと所属グループを追加
alter table public.teas
  add column if not exists color_hex text default '#C8A96E',   -- ティーカップで表示する色
  add column if not exists group_id uuid references public.tea_groups(id) on delete set null;

-- ③ 日本紅茶協会認定店
create table public.certified_shops (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  prefecture text,
  area text,                            -- エリア（首都圏・近畿 etc.）
  category text check (category in ('prestige','authentic','casual')),
  is_new boolean default false,         -- 当年新規認定
  is_award boolean default false,       -- 永年表彰店
  year integer not null,               -- 認定年度
  url text,
  note text,
  created_at timestamptz default now()
);

-- RLS
alter table public.tea_groups enable row level security;
alter table public.certified_shops enable row level security;

-- tea_groups: 全員閲覧、ログイン済み作成、作成者orAdmin編集・削除
create policy "tea_groups_select" on public.tea_groups for select using (true);
create policy "tea_groups_insert" on public.tea_groups for insert with check (auth.uid() is not null);
create policy "tea_groups_update" on public.tea_groups for update using (
  auth.uid() = created_by or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "tea_groups_delete" on public.tea_groups for delete using (
  is_official = false and (   -- 公式グループは削除不可
    auth.uid() = created_by or
    exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
);

-- certified_shops: 全員閲覧、管理者のみ追加・編集・削除
create policy "shops_select" on public.certified_shops for select using (true);
create policy "shops_insert" on public.certified_shops for insert with check (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "shops_update" on public.certified_shops for update using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "shops_delete" on public.certified_shops for delete using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- 初期グループデータ（公式）
insert into public.tea_groups (name, description, is_official) values
  ('定番紅茶',      '世界中で愛される定番の紅茶', true),
  ('日本のお茶',    '国産・日本が誇る茶葉',       true),
  ('中国茶・台湾茶','中国・台湾産の銘茶',         true),
  ('ハーブ・フレーバー', 'ハーブティーやフレーバード',true);

-- 初期認定店サンプル（2025年度）
insert into public.certified_shops (name, address, prefecture, area, category, is_new, is_award, year, url) values
  ('ロンドンティールーム 北堀江店', '大阪府大阪市西区北堀江1-1-23', '大阪', '近畿エリア', 'authentic', false, true, 2025, 'https://www.tea-a.gr.jp/shop/'),
  ('Tea Room Kararinn',           '東京都渋谷区',                 '東京', '首都圏エリア', 'prestige',  false, false, 2025, 'https://www.tea-a.gr.jp/shop/'),
  ('アフタヌーンティー・ティールーム 新宿高島屋店', '東京都新宿区', '東京', '首都圏エリア', 'casual', false, false, 2025, 'https://www.tea-a.gr.jp/shop/');
