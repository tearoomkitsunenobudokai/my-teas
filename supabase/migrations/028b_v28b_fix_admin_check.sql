-- =============================================
-- TeaNote v28b マイグレーション（028の補足）
-- Supabase SQL Editor で実行してください
-- =============================================
-- is_current_user_admin() を製作者も管理者扱いになるよう更新する
-- （製作者は管理者の上位互換のため）

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin or is_creator from public.profiles where id = auth.uid()),
    false
  )
$$;
