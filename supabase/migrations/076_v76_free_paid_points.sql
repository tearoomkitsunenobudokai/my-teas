-- =============================================
-- TeaNote v76 マイグレーション（無料ポイント／課金ポイントの区別）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 方針:
--   ・profiles.points は「合計残高」として維持する（既存UIは変更不要）
--   ・新たに profiles.points_free / points_paid を内訳キャッシュとして追加
--   ・実体（どの分がいつ失効するか）は point_lots（ポイントの「ロット」）で管理する
--       - kind='free': expires_at が必ず入る（無料配布・初回特典・ログインボーナス）
--       - kind='paid': expires_at は null（購入分・無期限）
--   ・消費（consume_points）は「無料ロットのうち期限が近いもの」から優先的に減らし、
--     無料分を使い切ったら課金ロットから減らす
--   ・無料ロットは期限切れになると自動的に失効させる（sweep_expired_free_points）

-- ① ポイントロット・テーブル
create table if not exists public.point_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('free', 'paid')),
  amount int not null check (amount >= 0),        -- このロットの残量
  original_amount int not null check (original_amount >= 0),
  expires_at timestamptz,                          -- free のみ使用。paid は常に null（無期限）
  source text,                                      -- 付与理由（表示用）
  created_at timestamptz not null default now()
);

alter table public.point_lots enable row level security;

drop policy if exists "point_lots_select_own" on public.point_lots;
create policy "point_lots_select_own" on public.point_lots
  for select using (auth.uid() = user_id);

drop policy if exists "point_lots_select_admin" on public.point_lots;
create policy "point_lots_select_admin" on public.point_lots
  for select using (public.is_current_user_admin());

-- insert/update/delete はクライアントから直接不可（関数経由のみ）

create index if not exists idx_point_lots_user_free_expiry
  on public.point_lots (user_id, kind, expires_at)
  where kind = 'free' and amount > 0;

-- ② profiles に内訳キャッシュ列を追加
alter table public.profiles
  add column if not exists points_free int not null default 0,
  add column if not exists points_paid int not null default 0;

-- 既存ユーザーの初期値: 現在の合計をすべて「課金扱い（無期限）」として1ロットに変換する。
-- 過去分をどちらに割り振るか厳密な根拠がないため、安全側（失効させない）に倒す。
insert into public.point_lots (user_id, kind, amount, original_amount, expires_at, source, created_at)
select id, 'paid', points, points, null, '（移行）既存残高', now()
from public.profiles
where points > 0
  and not exists (select 1 from public.point_lots pl where pl.user_id = profiles.id);

update public.profiles set points_paid = points, points_free = 0 where points > 0;

-- ③ 設定値: 無料ポイントの有効期限（日数）
insert into public.app_settings (key, value, description) values
  ('points_free_expiry_days', '60', '無料ポイント（初回特典・ログインボーナス・無料配布）の有効期限（日数）')
on conflict (key) do nothing;

-- ④ 無料ポイントを付与する関数
create or replace function public.grant_free_points(p_user_id uuid, p_amount int, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_expires timestamptz;
begin
  if p_amount <= 0 then return; end if;
  v_days := public.get_setting_int('points_free_expiry_days', 60);
  v_expires := now() + make_interval(days => v_days);

  insert into public.point_lots (user_id, kind, amount, original_amount, expires_at, source)
  values (p_user_id, 'free', p_amount, p_amount, v_expires, p_source);

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points + p_amount, points_free = points_free + p_amount
    where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

-- ⑤ 課金ポイントを付与する関数（無期限）
create or replace function public.grant_paid_points(p_user_id uuid, p_amount int, p_source text)
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
end;
$$;

-- ⑥ 期限切れの無料ロットを失効させる（消費時・閲覧時に自分の分だけ都度チェックする軽量版）
create or replace function public.sweep_expired_free_points(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_expired int;
begin
  select coalesce(sum(amount), 0) into v_total_expired
  from public.point_lots
  where user_id = p_user_id and kind = 'free' and amount > 0 and expires_at is not null and expires_at <= now();

  if v_total_expired <= 0 then return; end if;

  update public.point_lots
    set amount = 0
    where user_id = p_user_id and kind = 'free' and amount > 0 and expires_at is not null and expires_at <= now();

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = greatest(0, points - v_total_expired),
        points_free = greatest(0, points_free - v_total_expired)
    where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, -v_total_expired, 'carryover_expiry', '無料ポイントの有効期限切れ');
end;
$$;

grant execute on function public.sweep_expired_free_points(uuid) to authenticated;

-- ⑦ consume_points を「無料ロットから優先消費」する実装に置き換え
create or replace function public.consume_points(p_amount int, p_feature text default null)
returns table(success boolean, remaining int, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exempt boolean;
  v_points int;
  v_remaining int;
  v_lot record;
  v_take int;
  v_free_used int := 0;
  v_paid_used int := 0;
begin
  select (is_admin or is_creator) into v_exempt
  from public.profiles where id = auth.uid();

  if v_exempt is true then
    select points into v_points from public.profiles where id = auth.uid();
    return query select true, coalesce(v_points, 0), '製作者/管理者はポイント消費なし';
    return;
  end if;

  perform public.sweep_expired_free_points(auth.uid());

  select points into v_points from public.profiles where id = auth.uid();
  if v_points is null or v_points < p_amount then
    return query select false, coalesce(v_points, 0), 'ポイントが不足しています。';
    return;
  end if;

  v_remaining := p_amount;

  for v_lot in
    select id, amount from public.point_lots
    where user_id = auth.uid() and kind = 'free' and amount > 0
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
      where user_id = auth.uid() and kind = 'paid' and amount > 0
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

  if v_remaining > 0 then
    return query select false, coalesce(v_points, 0), 'ポイントが不足しています。';
    return;
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points - p_amount,
        points_free = greatest(0, points_free - v_free_used),
        points_paid = greatest(0, points_paid - v_paid_used)
    where id = auth.uid()
    returning points into v_points;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (auth.uid(), -p_amount, 'consumption', p_feature);

  return query select true, v_points, 'ok';
end;
$$;

-- ⑧ 新規登録時の初期ポイントを「無料（期限あり）」として付与するよう変更
--    旧: BEFORE INSERT で直接 points を書き換えていたが、point_lots に行を作るには
--        profiles 行が存在している必要があるため AFTER INSERT に変更する。
drop trigger if exists trg_apply_initial_points on public.profiles;

create or replace function public.apply_initial_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int;
begin
  v_amount := public.get_setting_int('points_initial', 5);
  if v_amount > 0 then
    perform public.grant_free_points(new.id, v_amount, '新規登録特典');
  end if;
  return new;
end;
$$;

create trigger trg_apply_initial_points
  after insert on public.profiles
  for each row execute function public.apply_initial_points();

-- ⑨ ログインボーナスも「無料（期限あり）」として付与するよう変更
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

    perform public.grant_free_points(auth.uid(), v_granted, 'ログインボーナス（' || v_need || '日達成）');
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

-- ⑩ 無料配布プラン（price_yen=0）は「無料（期限あり）」として付与
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

  perform public.grant_free_points(v_uid, v_pkg.points, v_pkg.label || '（無料配布）');

  return json_build_object('success', true, 'points', v_pkg.points);
end;
$$;

grant execute on function public.claim_free_package(uuid) to authenticated;

-- ⑪ 月次付与（課金ユーザー向け）: 内訳キャッシュとの整合のため points_paid も更新する。
--    ※ Stripe決済は本稿執筆時点で未接続のため、この経路は現状未使用（将来の本接続時に見直し予定）。
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
  v_grant int;
  v_carry_max int;
begin
  select points into v_balance from public.profiles where id = p_user_id;
  if v_balance is null then return; end if;

  v_grant     := public.get_setting_int('points_monthly_grant', 10);
  v_carry_max := public.get_setting_int('points_carryover_max', 10);

  v_carry := least(v_balance, v_carry_max);
  v_overflow := v_balance - v_carry;

  if v_overflow > 0 then
    insert into public.points_ledger(user_id, amount, type, description)
    values (p_user_id, -v_overflow, 'carryover_expiry',
            '繰越上限（' || v_carry_max || 'pt）超過分の失効');
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = v_carry + v_grant,
        points_paid = greatest(0, v_carry + v_grant - points_free)
    where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, v_grant, 'monthly_grant', '月額プラン ポイント付与');
end;
$$;
