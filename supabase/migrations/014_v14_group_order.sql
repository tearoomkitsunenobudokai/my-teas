-- =============================================
-- TeaNote v14 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- グループの並び順カラムを追加
alter table public.tea_groups
  add column if not exists sort_order integer default 100;

-- 既存グループに現在の作成順で初期値を設定
-- （テンプレートグループは is_template フラグで別途最優先表示されるため、
--   sort_order は「テンプレート以外」のグループ間での並び順として使う）
with ordered as (
  select id, row_number() over (order by is_official desc, created_at) * 10 as rn
  from public.tea_groups
)
update public.tea_groups g
set sort_order = o.rn
from ordered o
where g.id = o.id;
