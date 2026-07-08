-- =============================================
-- TeaNote v23 マイグレーション（022の不具合修正）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 022で追加した profiles_admin_select_all / profiles_admin_update_all は、
-- profiles テーブルのポリシーの中で profiles テーブル自身をサブクエリ参照しており、
-- 「infinite recursion detected in policy for relation "profiles"」エラーの原因になっていました。
-- このエラーにより profiles への通常の SELECT も失敗し、名前が取得できず "?" 表示になっていました。
--
-- SECURITY DEFINER 関数で RLS を迂回して is_admin を判定する形に直します。

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 古い（再帰エラーの原因になる）ポリシーを削除して、関数を使う形で作り直す
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.is_current_user_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- reviews / shop_visits 側も同じ関数に統一（こちらは自己参照ではないため動作はしていましたが、
-- 一貫性と将来的な安全性のため同じ判定関数に揃えます）
drop policy if exists "reviews_admin_select_all" on public.reviews;
create policy "reviews_admin_select_all" on public.reviews
  for select using (public.is_current_user_admin());

drop policy if exists "shop_visits_admin_select_all" on public.shop_visits;
create policy "shop_visits_admin_select_all" on public.shop_visits
  for select using (public.is_current_user_admin());
