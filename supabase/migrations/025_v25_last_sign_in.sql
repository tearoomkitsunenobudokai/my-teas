-- =============================================
-- TeaNote v25 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
-- auth.users の last_sign_in_at を管理者が取得できるようにする。
-- auth スキーマは通常のクライアントからアクセス不可のため、
-- SECURITY DEFINER 関数経由で安全に公開する。

create or replace function public.get_users_last_sign_in()
returns table(id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language sql
security definer
set search_path = auth, public
stable
as $$
  select id, last_sign_in_at, created_at from auth.users;
$$;

-- authenticated ロールに実行権限を付与（anon は不可）
-- アプリ側で is_admin チェックを行うことで管理者のみが実質的に利用する
revoke execute on function public.get_users_last_sign_in() from anon;
grant execute on function public.get_users_last_sign_in() to authenticated;
