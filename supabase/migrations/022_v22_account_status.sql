-- =============================================
-- TeaNote v22 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① アカウント制限フラグを追加
--    normal           = 通常（制限なし）
--    write_restricted = 書き込み制限（reviews / shop_visits への登録・更新を禁止）
--    login_disabled    = ログイン不可（アプリ側でログイン時に強制サインアウト）
--    ※ is_admin = true のユーザーはこのフラグの制約を一切受けない
alter table public.profiles
  add column if not exists account_status text not null default 'normal'
    check (account_status in ('normal', 'write_restricted', 'login_disabled'));

-- ② 管理者がユーザー管理画面で全ユーザーの情報を閲覧できるようにする
--    （既存の「自分の行だけ閲覧可」ポリシーに加えて、管理者用ポリシーを追加。
--      RLSのポリシーは同コマンドに対して複数あればOR条件で評価されるため、
--      既存ポリシーには影響しません）
create policy "profiles_admin_select_all" on public.profiles
  for select using (
    exists(select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  );

create policy "profiles_admin_update_all" on public.profiles
  for update using (
    exists(select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  ) with check (
    exists(select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  );

create policy "reviews_admin_select_all" on public.reviews
  for select using (
    exists(select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  );

create policy "shop_visits_admin_select_all" on public.shop_visits
  for select using (
    exists(select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  );

-- ③ 書き込み制限の実体（トリガーでINSERT/UPDATEをブロック）
--    RLSのポリシーだけで実装すると既存ポリシー定義の正確な内容が不明なため、
--    確実に効かせられるトリガー方式で実装する。管理者は対象外。
create or replace function public.enforce_account_write_restriction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_is_admin boolean;
begin
  select account_status, is_admin into v_status, v_is_admin
  from public.profiles
  where id = new.user_id;

  if v_is_admin is true then
    return new; -- 管理者は制限を受けない
  end if;

  if v_status in ('write_restricted', 'login_disabled') then
    raise exception 'このアカウントは現在、書き込みが制限されています。'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reviews_write_restriction on public.reviews;
create trigger trg_reviews_write_restriction
  before insert or update on public.reviews
  for each row execute function public.enforce_account_write_restriction();

drop trigger if exists trg_shop_visits_write_restriction on public.shop_visits;
create trigger trg_shop_visits_write_restriction
  before insert or update on public.shop_visits
  for each row execute function public.enforce_account_write_restriction();
