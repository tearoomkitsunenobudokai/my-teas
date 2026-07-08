-- =============================================
-- TeaNote v49 マイグレーション（ポイント等の改竄防止）
-- Supabase SQL Editor で実行してください
-- =============================================
-- profiles テーブルの以下のカラムを、一般ユーザーが直接UPDATEで
-- 書き換えられないように保護する。
--   points          : AI分析ポイント（課金要素・最重要）
--   account_status  : アカウント制限（自分で解除できてはいけない）
--   is_subscribed   : サブスク状態（自分で有効化できてはいけない）
--
-- これらは SECURITY DEFINER 関数（consume_points / process_monthly_grant /
-- grant_purchased_points / admin_adjust_points 等）経由でのみ変更を許可する。
--
-- 仕組み：
--   SECURITY DEFINER 関数は実行時に GUC フラグ（app.bypass_profile_guard）を立て、
--   トリガーはそのフラグが立っている時だけ変更を通す。
--   通常のクライアントUPDATE（フラグなし）では、これらの列の変更を拒否する。
--   （is_admin / is_creator は 028/029 の別トリガーで既に保護済み）

-- ① 保護トリガー関数
create or replace function public.enforce_sensitive_column_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass text;
begin
  -- 関数経由の変更は bypass フラグが立っているのでスルー
  begin
    v_bypass := current_setting('app.bypass_profile_guard', true);
  exception when others then
    v_bypass := null;
  end;
  if v_bypass = 'on' then
    return new;
  end if;

  -- フラグなし（＝通常のクライアント直接UPDATE）で保護対象カラムが変わっていたら拒否
  if (new.points          IS DISTINCT FROM old.points) or
     (new.account_status  IS DISTINCT FROM old.account_status) or
     (new.is_subscribed   IS DISTINCT FROM old.is_subscribed) then
    raise exception 'この項目は直接変更できません（ポイント・制限状態・サブスク状態はシステム経由でのみ更新されます）。'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sensitive_guard on public.profiles;
create trigger trg_profiles_sensitive_guard
  before update on public.profiles
  for each row execute function public.enforce_sensitive_column_guard();

-- ② 既存の各関数に bypass フラグの設定を追加して作り直す
--    （フラグを立ててから profiles を更新し、関数内で完結させる）

-- consume_points（ポイント消費）
create or replace function public.consume_points(p_amount int, p_feature text default null)
returns table(success boolean, remaining int, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exempt boolean;
  v_points int;
begin
  select (is_admin or is_creator) into v_exempt
  from public.profiles where id = auth.uid();

  if v_exempt is true then
    select points into v_points from public.profiles where id = auth.uid();
    return query select true, coalesce(v_points, 0), '製作者/管理者はポイント消費なし';
    return;
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);

  update public.profiles
  set points = points - p_amount
  where id = auth.uid() and points >= p_amount
  returning points into v_points;

  if v_points is null then
    perform set_config('app.bypass_profile_guard', 'off', true);
    select points into v_points from public.profiles where id = auth.uid();
    return query select false, coalesce(v_points, 0), 'ポイントが不足しています。';
    return;
  end if;

  insert into public.points_ledger(user_id, amount, type, description)
  values (auth.uid(), -p_amount, 'consumption', p_feature);

  perform set_config('app.bypass_profile_guard', 'off', true);
  return query select true, v_points, 'ok';
end;
$$;

-- process_monthly_grant（月次付与＋繰越）
create or replace function public.process_monthly_grant(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_carry int;
  v_overflow int;
begin
  select points into v_balance from public.profiles where id = p_user_id;
  if v_balance is null then return; end if;

  v_carry := least(v_balance, 10);
  v_overflow := v_balance - v_carry;

  perform set_config('app.bypass_profile_guard', 'on', true);

  if v_overflow > 0 then
    insert into public.points_ledger(user_id, amount, type, description)
    values (p_user_id, -v_overflow, 'carryover_expiry', '繰越上限（10pt）超過分の失効');
  end if;

  update public.profiles set points = v_carry + 10 where id = p_user_id;

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, 10, 'monthly_grant', '月額プラン ポイント付与');

  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

-- grant_purchased_points（購入付与・決済Webhook経由のみ）
create or replace function public.grant_purchased_points(p_user_id uuid, p_amount int, p_description text default '購入')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'この関数は決済Webhook経由でのみ実行できます。' using errcode = 'P0001';
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set points = points + p_amount where id = p_user_id;
  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, p_amount, 'purchase', p_description);
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

-- ③ アカウント制限の更新は管理者のみ許可する関数（ユーザー管理画面から使用）
create or replace function public.admin_set_account_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception '管理者権限が必要です。' using errcode = 'P0001';
  end if;
  if p_status not in ('normal', 'write_restricted', 'login_disabled') then
    raise exception '不正なステータスです。' using errcode = 'P0001';
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set account_status = p_status where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

revoke execute on function public.admin_set_account_status(uuid, text) from anon;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;
