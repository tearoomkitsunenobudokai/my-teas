-- =============================================
-- TeaNote v10 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 色パレットテーブル
create table if not exists public.tea_colors (
  id uuid default uuid_generate_v4() primary key,
  name text not null,              -- 色の名前（例: 茶褐色、赤橙色）
  name_en text,                    -- 英語名（任意）
  hex text not null,               -- カラーコード（例: #C8A96EB0）
  description text,                -- 説明（例: アッサムや濃いめの紅茶に多い深い色）
  category text check (category in ('red','orange','yellow','green','brown','clear','other')) default 'other',
  is_official boolean default false,  -- 管理者定義=true、ユーザー定義=false
  created_by uuid references public.profiles(id) on delete set null,
  sort_order integer default 100,  -- 表示順
  created_at timestamptz default now()
);

alter table public.tea_colors enable row level security;
create policy "colors_select" on public.tea_colors for select using (true);
create policy "colors_insert" on public.tea_colors for insert with check (auth.uid() is not null);
create policy "colors_update" on public.tea_colors for update using (
  auth.uid() = created_by or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "colors_delete" on public.tea_colors for delete using (
  (is_official = false and auth.uid() = created_by) or
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- 初期データ：日本紅茶協会の水色分類に基づくデフォルトカラー
insert into public.tea_colors (name, name_en, hex, description, category, is_official, sort_order) values
  -- 紅茶系（赤・橙・茶）
  ('明るい橙色',   'Bright Orange',      '#F5C842C8', '浅蒸しやファーストフラッシュに多い、明るく透明感のある橙色', 'orange', true, 10),
  ('橙色',         'Orange',             '#E8A020C8', '一般的な紅茶の水色。バランスの取れた抽出を示す',           'orange', true, 20),
  ('赤橙色',       'Red-Orange',         '#C8601AB0', 'セカンドフラッシュやセイロンに多い、深みのある赤橙色',     'orange', true, 30),
  ('明るい赤色',   'Bright Red',         '#C0382AB0', '発酵が進んだ紅茶に見られる鮮やかな赤色',                  'red',    true, 40),
  ('深い赤色',     'Deep Red',           '#8B1A14B0', 'アッサムCTCや強発酵茶に多い、濃い赤褐色',                 'red',    true, 50),
  ('茶褐色',       'Brown',              '#6B3A2AB0', 'ミルクティー向けの濃い抽出や、熟成した紅茶の色',           'brown',  true, 60),
  ('琥珀色',       'Amber',              '#C8861EB0', '透明感のある黄金色。ダージリン1stフラッシュに多い',        'yellow', true, 70),
  ('黄金色',       'Golden',             '#D4A520B0', 'ファーストフラッシュや白茶に見られる輝く黄金色',           'yellow', true, 80),
  ('淡い黄色',     'Pale Yellow',        '#F5E6C8B0', '白茶や緑茶に多い、繊細で淡い黄色',                        'yellow', true, 90),
  -- 緑茶系
  ('黄緑色',       'Yellow-Green',       '#B8CC60B0', '煎茶に多い、黄みがかった緑色',                            'green',  true, 100),
  ('若草色',       'Grass Green',        '#8BC34AB0', '浅蒸し煎茶や新茶に見られる鮮やかな若草色',               'green',  true, 110),
  ('深緑色',       'Deep Green',         '#4CAF50B0', '深蒸し煎茶や玉露に多い、濃い緑色',                        'green',  true, 120),
  -- 烏龍茶系
  ('黄褐色',       'Yellow-Brown',       '#C8A040B0', '青烏龍茶（清香系）に多い明るい黄褐色',                    'yellow', true, 130),
  ('橙褐色',       'Orange-Brown',       '#A06828B0', '東方美人や熟成烏龍茶の橙褐色',                            'brown',  true, 140),
  -- 特殊
  ('透明（無色）', 'Clear',              '#F5F5F5B0', '水出しや極淡の白茶に見られるほぼ無色透明',               'clear',  true, 150),
  ('ロゼ色',       'Rose',               '#E8A0A0B0', '桃の花やベリー系フレーバーティーに多いロゼ色',            'red',    true, 160)
on conflict do nothing;
