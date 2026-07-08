-- =============================================
-- TeaNote v15 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 香り分析プリセットテーブル
create table if not exists public.aroma_presets (
  id uuid default uuid_generate_v4() primary key,
  group_name text not null,          -- 系統名（例: Green（グリーン））
  items text[] not null default '{}',-- 香り語の配列
  sort_order integer default 100,    -- グループの表示順
  is_official boolean default true,  -- 管理者定義のプリセット
  created_at timestamptz default now()
);

alter table public.aroma_presets enable row level security;
-- 全ユーザーが読み取り可能
create policy "aroma_presets_select" on public.aroma_presets for select using (true);
-- 管理者のみ追加・編集・削除可能
create policy "aroma_presets_insert" on public.aroma_presets for insert with check (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "aroma_presets_update" on public.aroma_presets for update using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "aroma_presets_delete" on public.aroma_presets for delete using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- 初期データ（三井農林 紅茶キャラクターホイール 9系統準拠）
insert into public.aroma_presets (group_name, items, sort_order) values
  ('Green（グリーン）',
   ARRAY['若草','青葉','青草','きゅうり','ピーマン','えんどう豆','ほうれん草','海苔','わかめ'],
   10),
  ('Woody（ウッディ）',
   ARRAY['ごぼう','木材','杉','土','苔','革','煙','セロリ','根菜'],
   20),
  ('Floral（フローラル）',
   ARRAY['スズラン','バラ','ジャスミン','金木犀','ライラック','スミレ','カモミール','菊','梅の花'],
   30),
  ('Fruity - Fresh（生の果実）',
   ARRAY['マスカット','青りんご','レモン','グレープフルーツ','ライム','柑橘','梨','メロン'],
   40),
  ('Fruity - Sweet（甘い果実）',
   ARRAY['アプリコット','ピーチ','マンゴー','パッションフルーツ','ライチ','パイナップル','バナナ','いちじく'],
   50),
  ('Fruity - Processed（加工果実）',
   ARRAY['干しぶどう','プルーン','レーズン','ドライアプリコット','干しいちじく','フルーツケーキ','ジャム'],
   60),
  ('Sweet（スウィート）',
   ARRAY['スイートポテト','黒砂糖','はちみつ','キャラメル','バニラ','メープルシロップ','チョコレート','和三盆'],
   70),
  ('Roast（ロースト）',
   ARRAY['麦茶','ほうじ茶','玄米','コーヒー','ナッツ','カカオ','焦げ','スモーク','パン'],
   80),
  ('Spicy（スパイシー）',
   ARRAY['湿布薬','シナモン','クローブ','カルダモン','ミント','ユーカリ','しょうが','胡椒','ハーブ'],
   90)
on conflict do nothing;
