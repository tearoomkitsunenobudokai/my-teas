-- =============================================
-- TeaNote データベーススキーマ
-- Supabase SQL Editor でこのファイルを実行してください
-- =============================================

-- 拡張機能
create extension if not exists "uuid-ossp";

-- =============================================
-- テーブル定義
-- =============================================

-- プロフィール (auth.usersと連動)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 茶葉マスタ
create table public.teas (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  origin text,
  category text not null check (category in ('black','green','oolong','white','herbal')),
  description text,
  is_official boolean default false,        -- 管理者登録=true, ユーザー登録=false
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 評価
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tea_id uuid references public.teas(id) on delete cascade not null,
  score_aroma integer check (score_aroma between 1 and 10),      -- 香り
  score_taste integer check (score_taste between 1 and 10),      -- 味
  score_color integer check (score_color between 1 and 10),      -- 色
  score_astringency integer check (score_astringency between 1 and 10), -- 渋み
  score_sweetness integer check (score_sweetness between 1 and 10),    -- 甘さ
  score_aftertaste integer check (score_aftertaste between 1 and 10),  -- 余韻
  comment text,
  is_public boolean default false,
  created_at timestamptz default now(),
  unique(user_id, tea_id)   -- 1ユーザー1茶葉につき1評価
);

-- =============================================
-- Row Level Security (RLS) ポリシー
-- =============================================

alter table public.profiles enable row level security;
alter table public.teas enable row level security;
alter table public.reviews enable row level security;

-- profiles: 自分のプロフィールのみ編集可、全員閲覧可
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- teas: 全員閲覧可、ログイン済みユーザーは追加可、管理者or作成者のみ削除可
create policy "teas_select" on public.teas for select using (true);
create policy "teas_insert" on public.teas for insert with check (auth.uid() is not null);
create policy "teas_update" on public.teas for update using (
  auth.uid() = created_by or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "teas_delete" on public.teas for delete using (
  auth.uid() = created_by or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- reviews: 公開評価は全員閲覧可、自分の評価のみCRUD可
create policy "reviews_select_public" on public.reviews for select using (is_public = true or auth.uid() = user_id);
create policy "reviews_insert" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update" on public.reviews for update using (auth.uid() = user_id);
create policy "reviews_delete" on public.reviews for delete using (auth.uid() = user_id);

-- =============================================
-- トリガー: 新規ユーザー登録時にprofileを自動作成
-- =============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- 初期データ (公式茶葉リスト)
-- =============================================
insert into public.teas (name, origin, category, description, is_official) values
  ('アッサム CTC',          'インド・アッサム州',           'black',  'コクと力強さが特徴の定番紅茶。ミルクティーに最適。', true),
  ('アールグレイ',           'ブレンド（ベルガモット）',      'black',  'ベルガモットの柑橘香が爽やかな、世界で最も有名な紅茶のひとつ。', true),
  ('ダージリン 1st フラッシュ','インド・ダージリン地方',       'black',  '紅茶のシャンパンと称される、春摘みの繊細な香り。', true),
  ('セイロン ウバ',          'スリランカ・ウバ高地',          'black',  'メントール系の涼やかな香りと、すっきりした渋み。', true),
  ('玉露',                   '日本・京都宇治',               'green',  '覆い下栽培による豊かな旨みとまろやかな甘さ。', true),
  ('煎茶',                   '日本',                        'green',  '清々しい青々しい香りと、ほど良い渋み。日本の定番緑茶。', true),
  ('龍井茶（ロンジン）',      '中国・浙江省',                'green',  '栗のような香ばしさと、さわやかな甘み。中国緑茶の最高峰。', true),
  ('凍頂烏龍',               '台湾・南投県',                'oolong', '花のような香りと焙煎の甘さが調和した半発酵茶。', true),
  ('東方美人',               '台湾・新竹県',                'oolong', 'ウンカに噛まれた葉が生み出す蜜のような甘い香り。', true),
  ('白毫銀針',               '中国・福建省',                'white',  '産毛に覆われた新芽だけを使った、繊細で上品な白茶。', true),
  ('カモミール',             'エジプト',                    'herbal', 'リンゴに似た優しい香りのハーブティー。リラックス効果で有名。', true),
  ('ペパーミント',           'モロッコ',                    'herbal', 'スーッとするメントール感が清涼感をもたらすハーブティー。', true);
