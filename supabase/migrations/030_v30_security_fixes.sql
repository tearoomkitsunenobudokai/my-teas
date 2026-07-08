-- =============================================
-- TeaNote v30 マイグレーション（セキュリティ強化）
-- Supabase SQL Editor で実行してください
-- =============================================

-- ─────────────────────────────────────────────
-- ① get_users_last_sign_in() に管理者チェックを追加
--    （これまでは一般ユーザーもRPC直叩きで全ユーザーのUUID・最終ログインを取得できた）
-- ─────────────────────────────────────────────
create or replace function public.get_users_last_sign_in()
returns table(id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = auth, public
stable
as $$
begin
  if not public.is_current_user_admin() then
    raise exception '管理者権限が必要です。' using errcode = 'P0001';
  end if;
  return query select u.id, u.last_sign_in_at, u.created_at from auth.users u;
end;
$$;

-- ─────────────────────────────────────────────
-- ② ログイン不可ユーザーのデータ読み取りをDBレベルでブロック
--    （クライアント側の強制サインアウトだけではAPI直叩きで読み取り可能だった）
--    RESTRICTIVE ポリシーで既存の許可ポリシーにAND条件として重ねる。
--    profiles は Header の状態チェックに必要なため対象外とする。
-- ─────────────────────────────────────────────
create or replace function public.is_current_user_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin or is_creator or account_status <> 'login_disabled'
     from public.profiles where id = auth.uid()),
    true  -- profiles 行がない（未ログイン等）は既存ポリシーに委ねる
  )
$$;

drop policy if exists "reviews_active_only" on public.reviews;
create policy "reviews_active_only" on public.reviews
  as restrictive for select using (public.is_current_user_active());

drop policy if exists "shop_visits_active_only" on public.shop_visits;
create policy "shop_visits_active_only" on public.shop_visits
  as restrictive for select using (public.is_current_user_active());

drop policy if exists "shop_bookmarks_active_only" on public.shop_bookmarks;
create policy "shop_bookmarks_active_only" on public.shop_bookmarks
  as restrictive for select using (public.is_current_user_active());

-- ─────────────────────────────────────────────
-- ③ 評価登録上限（max_reviews_per_user）のDBレベル強制
--    （これまではクライアント側チェックのみでAPI直叩きで迂回可能だった）
-- ─────────────────────────────────────────────
create or replace function public.enforce_review_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
  v_is_admin boolean;
begin
  select is_admin or is_creator into v_is_admin
  from public.profiles where id = new.user_id;
  if v_is_admin is true then return new; end if;

  select coalesce(nullif(value, '')::int, 0) into v_limit
  from public.app_settings where key = 'max_reviews_per_user';

  if v_limit is null or v_limit = 0 then return new; end if; -- 0 = 無制限

  select count(*) into v_count from public.reviews where user_id = new.user_id;
  if v_count >= v_limit then
    raise exception '評価の登録上限（%件）に達しています。', v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_limit on public.reviews;
create trigger trg_reviews_limit
  before insert on public.reviews
  for each row execute function public.enforce_review_limit();

-- ─────────────────────────────────────────────
-- ④ app_settings / aroma_presets の管理者判定を
--    is_current_user_admin()（製作者込み）に統一
--    （これまでは is_admin 直接参照のため、製作者(is_admin=false)が編集できなかった）
-- ─────────────────────────────────────────────
drop policy if exists "app_settings_update" on public.app_settings;
create policy "app_settings_update" on public.app_settings
  for update using (public.is_current_user_admin());

drop policy if exists "app_settings_insert" on public.app_settings;
create policy "app_settings_insert" on public.app_settings
  for insert with check (public.is_current_user_admin());

drop policy if exists "aroma_presets_insert" on public.aroma_presets;
create policy "aroma_presets_insert" on public.aroma_presets
  for insert with check (public.is_current_user_admin());

drop policy if exists "aroma_presets_update" on public.aroma_presets;
create policy "aroma_presets_update" on public.aroma_presets
  for update using (public.is_current_user_admin());

drop policy if exists "aroma_presets_delete" on public.aroma_presets;
create policy "aroma_presets_delete" on public.aroma_presets
  for delete using (public.is_current_user_admin());
