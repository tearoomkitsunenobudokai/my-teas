-- =============================================
-- TeaNote v81 マイグレーション
--   ① 新規登録の制限（管理者が切り替え）
--   ② ログイン画面にお知らせを表示できるようにする
-- Supabase SQL Editor で実行してください
-- =============================================

-- ─────────────────────────────────────────────
-- ① 新規登録の制限
-- ─────────────────────────────────────────────
-- 画面でボタンを隠すだけでは、APIを直接叩けば登録できてしまう。
-- そのため、アカウント作成時に必ず通る handle_new_user() で拒否する。

insert into public.app_settings (key, value, description) values
  ('signup_enabled', 'true', '新規登録を受け付けるか（true / false）'),
  ('signup_closed_message', 'ただいま新規登録を停止しています。再開までしばらくお待ちください。',
   '新規登録を停止しているときに表示するメッセージ')
on conflict (key) do nothing;

-- 未ログインでも参照できるようにする（ログイン画面での表示用）
create or replace function public.is_signup_enabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select value from public.app_settings where key = 'signup_enabled'), 'true') = 'true';
$$;

grant execute on function public.is_signup_enabled() to anon, authenticated;

create or replace function public.get_signup_closed_message()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select value from public.app_settings where key = 'signup_closed_message'), '');
$$;

grant execute on function public.get_signup_closed_message() to anon, authenticated;

-- アカウント作成時に登録可否を判定する
-- （メンテナンス中（full）も新規登録を止める）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_signup_enabled() then
    raise exception '%', coalesce(
      nullif(public.get_signup_closed_message(), ''),
      'ただいま新規登録を停止しています。'
    );
  end if;

  if public.get_maintenance_mode() = 'full' then
    raise exception 'ただいまメンテナンス中のため、新規登録を受け付けていません。';
  end if;

  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- 新規登録の受付を切り替える（管理者・製作者のみ）
create or replace function public.set_signup_enabled(p_enabled boolean, p_message text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  select coalesce(is_admin or is_creator, false) into v_ok
  from public.profiles where id = auth.uid();

  if v_ok is not true then
    raise exception '管理者のみ実行できます。';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('signup_enabled', case when p_enabled then 'true' else 'false' end, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if p_message is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('signup_closed_message', p_message, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return p_enabled;
end;
$$;

grant execute on function public.set_signup_enabled(boolean, text) to authenticated;


-- ─────────────────────────────────────────────
-- ② ログイン画面（未ログイン）にお知らせを表示する
-- ─────────────────────────────────────────────
-- announcements テーブルはログイン必須のため、未ログインでも読める専用の関数を用意する。
-- 掲載期間内・公開中のものだけを返す（内部の管理項目は返さない）。
create or replace function public.get_public_announcements()
returns table(title text, body text, published_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select a.title, a.body, a.published_at
  from public.announcements a
  where a.is_active = true
    and a.published_at <= now()
    and (a.expires_at is null or a.expires_at >= now())
  order by a.published_at desc
  limit 5;
$$;

grant execute on function public.get_public_announcements() to anon, authenticated;
