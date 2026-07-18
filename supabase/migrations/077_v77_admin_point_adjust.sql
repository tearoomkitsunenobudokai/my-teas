-- =============================================
-- TeaNote v77 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- ① 前回(076)の不具合修正:
--    grant_free_points / grant_paid_points が points_ledger に記録しておらず、
--    ログインボーナス・無料配布の受け取りが「ポイント履歴」に表示されなくなっていた。
--    → 記録タイプを指定できるようにし、各呼び出し元で正しいタイプを渡すよう修正する。
--
-- ② 管理者による手動でのポイント付与・調整機能を追加する（特定ユーザーを指定して実行）。

-- ① grant_free_points / grant_paid_points を拡張
--    p_ledger_type が null なら記録しない（従来通り履歴に出したくない付与のため）。
--    p_expires_at を指定すると、無料ポイントの期限を個別に上書きできる（管理者付与用）。
create or replace function public.grant_free_points(
  p_user_id uuid, p_amount int, p_source text,
  p_expires_at timestamptz default null,
  p_ledger_type text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if p_amount <= 0 then return; end if;
  v_expires := coalesce(p_expires_at, now() + make_interval(days => public.get_setting_int('points_free_expiry_days', 60)));

  insert into public.point_lots (user_id, kind, amount, original_amount, expires_at, source)
  values (p_user_id, 'free', p_amount, p_amount, v_expires, p_source);

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points + p_amount, points_free = points_free + p_amount
    where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);

  if p_ledger_type is not null then
    insert into public.points_ledger(user_id, amount, type, description)
    values (p_user_id, p_amount, p_ledger_type, p_source);
  end if;
end;
$$;

create or replace function public.grant_paid_points(
  p_user_id uuid, p_amount int, p_source text,
  p_ledger_type text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then return; end if;

  insert into public.point_lots (user_id, kind, amount, original_amount, expires_at, source)
  values (p_user_id, 'paid', p_amount, p_amount, null, p_source);

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points + p_amount, points_paid = points_paid + p_amount
    where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);

  if p_ledger_type is not null then
    insert into public.points_ledger(user_id, amount, type, description)
    values (p_user_id, p_amount, p_ledger_type, p_source);
  end if;
end;
$$;

-- ログインボーナス: 履歴タイプを 'daily_login' で復元
create or replace function public.record_login_and_grant()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
  v_count int;
  v_need int;
  v_bonus int;
  v_granted int := 0;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select last_login_date, login_count into v_last, v_count
  from public.profiles where id = auth.uid();

  if v_last is not null and v_last >= v_today then
    return 0;
  end if;

  v_need  := public.get_setting_int('login_bonus_days', 5);
  v_bonus := public.get_setting_int('login_bonus_points', 2);
  v_count := coalesce(v_count, 0) + 1;

  if v_count >= v_need then
    v_granted := v_bonus;
    v_count := 0;

    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set login_count = v_count, last_login_date = v_today
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);

    perform public.grant_free_points(auth.uid(), v_granted, 'ログインボーナス（' || v_need || '日達成）', null, 'daily_login');
  else
    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set login_count = v_count, last_login_date = v_today
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);
  end if;

  return v_granted;
end;
$$;

grant execute on function public.record_login_and_grant() to authenticated;

-- 無料配布プラン: 履歴タイプを 'purchase' で復元（従来通りの表示文言に戻す）
create or replace function public.claim_free_package(p_package_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg record;
  v_period text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return json_build_object('success', false, 'message', 'ログインが必要です');
  end if;

  select * into v_pkg from public.point_packages where id = p_package_id and is_active = true;
  if v_pkg is null then
    return json_build_object('success', false, 'message', 'プランが見つかりません');
  end if;
  if v_pkg.price_yen <> 0 then
    return json_build_object('success', false, 'message', 'このプランは無料配布の対象ではありません');
  end if;
  if v_pkg.is_limited and (v_pkg.limited_until is null or v_pkg.limited_until <= now()) then
    return json_build_object('success', false, 'message', 'この期間限定オファーは終了しました');
  end if;

  v_period := case when v_pkg.is_limited then v_pkg.limited_until::text else 'permanent' end;

  begin
    insert into public.point_package_claims (user_id, package_id, period_key)
    values (v_uid, p_package_id, v_period);
  exception when unique_violation then
    return json_build_object('success', false, 'message', 'このプランは既に受け取り済みです');
  end;

  perform public.grant_free_points(v_uid, v_pkg.points, v_pkg.label || '（無料配布）', null, 'purchase');

  return json_build_object('success', true, 'points', v_pkg.points);
end;
$$;

grant execute on function public.claim_free_package(uuid) to authenticated;


-- ② 管理者による手動ポイント付与・調整
--    p_delta > 0 : 付与（p_kindで free/paid を選択。freeはp_expires_atで期限を上書き可、
--                  未指定なら通常の無料ポイントと同じ有効期限設定に従う）
--    p_delta < 0 : 減算（無料ロットから優先して減らし、残高を超える分は減算しない）
--    呼び出しは管理者・製作者のみ許可。
create or replace function public.admin_adjust_points(
  p_user_id uuid,
  p_delta int,
  p_kind text default 'paid',
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns table(success boolean, new_balance int, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_points int;
  v_remaining int;
  v_lot record;
  v_take int;
  v_free_used int := 0;
  v_paid_used int := 0;
  v_actual_delta int;
  v_reason text;
begin
  select (is_admin or is_creator) into v_is_admin from public.profiles where id = auth.uid();
  if v_is_admin is not true then
    return query select false, 0, '管理者のみ実行できます。';
    return;
  end if;

  if p_delta = 0 then
    select points into v_points from public.profiles where id = p_user_id;
    return query select true, coalesce(v_points, 0), '変更なし';
    return;
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), '管理者による調整');

  if p_delta > 0 then
    if p_kind = 'free' then
      perform public.grant_free_points(p_user_id, p_delta, v_reason, p_expires_at, 'admin_adjust');
    else
      perform public.grant_paid_points(p_user_id, p_delta, v_reason, 'admin_adjust');
    end if;

    select points into v_points from public.profiles where id = p_user_id;
    return query select true, coalesce(v_points, 0), '付与しました';
    return;
  end if;

  -- p_delta < 0（減算）: 無料ロットから優先して減らし、残高を超える分は減らさない
  v_remaining := least(-p_delta, (select points from public.profiles where id = p_user_id));
  if v_remaining <= 0 then
    select points into v_points from public.profiles where id = p_user_id;
    return query select true, coalesce(v_points, 0), '対象ポイントがありません';
    return;
  end if;

  for v_lot in
    select id, amount from public.point_lots
    where user_id = p_user_id and kind = 'free' and amount > 0
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_lot.amount, v_remaining);
    update public.point_lots set amount = amount - v_take where id = v_lot.id;
    v_remaining := v_remaining - v_take;
    v_free_used := v_free_used + v_take;
  end loop;

  if v_remaining > 0 then
    for v_lot in
      select id, amount from public.point_lots
      where user_id = p_user_id and kind = 'paid' and amount > 0
      order by created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_lot.amount, v_remaining);
      update public.point_lots set amount = amount - v_take where id = v_lot.id;
      v_remaining := v_remaining - v_take;
      v_paid_used := v_paid_used + v_take;
    end loop;
  end if;

  v_actual_delta := v_free_used + v_paid_used;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points - v_actual_delta,
        points_free = greatest(0, points_free - v_free_used),
        points_paid = greatest(0, points_paid - v_paid_used)
    where id = p_user_id
    returning points into v_points;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, -v_actual_delta, 'admin_adjust', v_reason);

  return query select true, v_points, '調整しました';
end;
$$;

grant execute on function public.admin_adjust_points(uuid, int, text, text, timestamptz) to authenticated;
