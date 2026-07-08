-- =============================================
-- TeaNote v11 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① tea_groups に「テンプレート専用」フラグを追加
--    is_template = true のグループは一覧の最上部に固定表示される
alter table public.tea_groups
  add column if not exists is_template boolean default false;

-- ② 既存の公式グループを編集可能にするためのRLS見直し
--    （002_v2_schema.sql の policy では is_official=true の削除を禁止していたため、管理者には許可する）
drop policy if exists "tea_groups_delete" on public.tea_groups;
create policy "tea_groups_delete" on public.tea_groups for delete using (
  -- 管理者は全グループ削除可
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  -- 一般ユーザーは自分が作った非公式グループのみ削除可
  or (is_official = false and auth.uid() = created_by)
);

-- update も同様に管理者には常に許可（既存ポリシーは概ねOKだが明示的に再作成）
drop policy if exists "tea_groups_update" on public.tea_groups;
create policy "tea_groups_update" on public.tea_groups for update using (
  exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  or auth.uid() = created_by
);

-- ③ 「テンプレート集（参照作成用）」グループを作成
insert into public.tea_groups (name, description, is_official, is_template)
values ('📋 テンプレート集（参照作成用）', '管理者が用意したひな型。複製してから自分用に編集してください。', true, true)
on conflict do nothing;

-- ④ 三大紅茶（キームン・ウバ・ダージリン）をテンプレートとして登録
do $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.tea_groups where is_template = true limit 1;

  insert into public.teas (name, origin, category, description, color_hex, group_id, is_official, tea_form, weight_g, steep_seconds)
  values
    ('キームン（祁門紅茶）', '中国・安徽省祁門県', 'black',
     '世界三大紅茶のひとつ。スモーキーで蘭の花を思わせる独特の香り（キームン香）を持つ。中国を代表する紅茶で、ストレートでもミルクでも楽しめる。',
     '#6B3A2AB0', v_group_id, true, 'leaf', 3, 240),

    ('ウバ', 'スリランカ・ウバ州', 'black',
     '世界三大紅茶のひとつ。メントールやサリチル酸メチルに由来する独特の爽快な香り「ウバフレーバー」が特徴。鮮やかな赤色の水色と、きりっとした渋みを持つ。',
     '#C0382AB0', v_group_id, true, 'leaf', 3, 180),

    ('ダージリン', 'インド・西ベンガル州ダージリン地方', 'black',
     '世界三大紅茶のひとつ。「紅茶のシャンパン」と称される華やかでフルーティーな香りが特徴。摘採期によって風味が大きく変わり、ファーストフラッシュは爽やかでマスカットのような香りを持つ。',
     '#D4A520B0', v_group_id, true, 'leaf', 3, 210)
  on conflict do nothing;
end $$;
