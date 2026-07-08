-- =============================================
-- TeaNote v50 マイグレーション（プロフィール露出の最小化）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 課題: これまで profiles テーブルは「全員が閲覧可」なポリシーになっている場合があり、
--       他ユーザーの points / account_status / is_subscribed / is_admin まで
--       クエリで読み取れてしまう恐れがある。
-- 対応: ① 他ユーザーに見せてよい列だけを持つ公開ビュー public_profiles を用意
--       ② profiles 本体の SELECT は「本人のみ（＋管理者は全件）」に制限
--       ③ コミュニティ等は public_profiles を参照する

-- ① 公開用ビュー（他人に見せてよい列だけ）
create or replace view public.public_profiles as
select
  id,
  name,
  bio,
  favorite_tea,
  location_area,
  location_prefecture,
  location_visibility
from public.profiles;

-- ビューは呼び出し元の権限で動くと再帰的にRLSに阻まれるため、
-- security_invoker を無効化し（デフォルト）、ビュー経由なら安全な列だけ読める形にする。
-- authenticated ロールに SELECT 権限を付与
grant select on public.public_profiles to anon, authenticated;

-- ② profiles 本体のSELECTを本人＋管理者のみに制限する
--    まず「全員閲覧可」系の既存ポリシーがあれば削除（名前は環境により異なるため代表的なものを対象）
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "Enable read access for all users" on public.profiles;

-- 本人のみ自分の全行を閲覧可
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- 管理者は全件閲覧可（023で作成済みの profiles_admin_select_all が残っていれば重複しないよう作り直し）
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.is_current_user_admin());

-- ③ 注意:
--    アプリ側（community/page.tsx など）は profiles(...) の代わりに
--    public_profiles を参照するように変更済み（v110）。
--    もし他にも profiles を直接JOINしている箇所があれば public_profiles に変更すること。

-- ④ サブスク状態の変更は管理者のみ許可する関数（決済連携前の手動運用・テスト用）
--    049のガードにより is_subscribed は直接UPDATE不可なので、この関数経由で更新する。
create or replace function public.admin_set_subscription(p_user_id uuid, p_subscribed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception '管理者権限が必要です。' using errcode = 'P0001';
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set is_subscribed = p_subscribed where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

revoke execute on function public.admin_set_subscription(uuid, boolean) from anon;
grant execute on function public.admin_set_subscription(uuid, boolean) to authenticated;
