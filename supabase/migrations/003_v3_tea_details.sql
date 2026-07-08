-- =============================================
-- TeaNote v3 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① teas テーブルに詳細フィールドを追加
alter table public.teas
  add column if not exists tea_form text check (tea_form in ('leaf','teabag','unknown')) default 'unknown',
  add column if not exists weight_g numeric,           -- 茶葉のグラム数
  add column if not exists steep_seconds integer,      -- 淹れ時間（秒）
  add column if not exists shop_name text,             -- 飲んだお店（手打ちまたは認定店名）
  add column if not exists shop_id uuid references public.certified_shops(id) on delete set null,
  add column if not exists maker_id uuid,              -- メーカーID（後で参照）
  add column if not exists maker_name text;            -- メーカー名（手打ちフォールバック）

-- ② メーカーマスタ
create table if not exists public.makers (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  country text,
  description text,
  url text,
  is_official boolean default false,
  created_at timestamptz default now()
);

-- maker_id の外部キーを後付け
alter table public.teas
  add constraint teas_maker_fk foreign key (maker_id) references public.makers(id) on delete set null;

-- RLS
alter table public.makers enable row level security;
create policy "makers_select" on public.makers for select using (true);
create policy "makers_insert" on public.makers for insert with check (auth.uid() is not null);
create policy "makers_update" on public.makers for update using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ③ 初期メーカーデータ
insert into public.makers (name, country, description, is_official) values
  ('リプトン',           '英国/日本',  '世界最大の紅茶ブランド。イエローラベルが有名。',       true),
  ('トワイニング',        '英国',      '1706年創業の老舗。アールグレイの元祖。',               true),
  ('フォートナム＆メイソン','英国',     'ロンドン発の高級食料品店。王室御用達。',               true),
  ('ウェッジウッド',      '英国',      '陶磁器ブランドとしても有名なプレミアム紅茶。',         true),
  ('マリアージュ フレール','フランス',  'パリ発の高級紅茶専門店。豊富なフレーバーティーが有名。',true),
  ('ルピシア',            '日本',      '世界各地の茶葉を扱う日本の紅茶・お茶専門店。',         true),
  ('ジャンナッツ',        'フランス',  'パリの老舗紅茶専門店。美しい缶が特徴。',               true),
  ('ハーニー＆サンズ',    '米国',      'ニューヨーク発のプレミアム紅茶ブランド。',             true),
  ('スリランカ紅茶公社',  'スリランカ','ディルマなど高品質なセイロンティーを展開。',           true),
  ('伊藤園',             '日本',      '日本最大の緑茶メーカー。ペットボトル茶でも有名。',      true),
  ('宇治田原製茶場',      '日本',      '京都・宇治田原の老舗製茶場。',                         true),
  ('一保堂茶舗',          '日本',      '1717年創業の京都の老舗茶舗。上質な抹茶・煎茶。',       true),
  ('ダーリントン',        '英国',      '英国の伝統的な紅茶ブランド。',                         true),
  ('アーマッド',          '英国',      'アフガニスタン系英国ブランド。コスパで人気。',         true),
  ('クリッパー',          '英国',      'オーガニック・フェアトレード認証の紅茶ブランド。',     true)
on conflict (name) do nothing;
