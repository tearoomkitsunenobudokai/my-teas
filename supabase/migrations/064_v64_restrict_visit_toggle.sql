-- =============================================
-- TeaNote v64 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 認定店「訪問済み」チェックの手動変更を管理者・製作者のみに制限する。
-- 背景: これまでは一般/課金ユーザーが自分の訪問済みステータスを
--       自由にON/OFFでき、certified_countの自己申告的な操作が可能だった。
--       今後は管理者・製作者のみが手動変更できるようにする。
--
-- 閲覧（select）は従来通り本人のみのまま変更しない。

drop policy if exists "visits_insert" on public.shop_visits;
create policy "visits_insert" on public.shop_visits
  for insert with check (
    auth.uid() = user_id
    and public.is_current_user_admin()
  );

drop policy if exists "visits_delete" on public.shop_visits;
create policy "visits_delete" on public.shop_visits
  for delete using (
    auth.uid() = user_id
    and public.is_current_user_admin()
  );
