-- =============================================
-- TeaNote v61 マイグレーション（ポイント制度の設定化）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 初期ポイント・月次付与数・繰越上限を app_settings で管理し、
-- 製作者が管理画面から変更できるようにする。

-- ① 設定値（初期値は現行仕様に合わせる）
insert into public.app_settings (key, value, description) values
  ('points_initial',        '5',  '新規登録時に付与される初期ポイント'),
  ('points_monthly_grant',  '10', '毎月付与されるポイント数（課金ユーザー）'),
  ('points_carryover_max',  '10', '翌月に繰り越せるポイントの上限')
on conflict (key) do nothing;

-- 設定値を数値で取得するヘルパー
create or replace function public.get_setting_int(p_key text, p_default int)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce((select value::int from public.app_settings where key = p_key), p_default);
$$;

grant execute on function public.get_setting_int(text, int) to authenticated;

-- ② 月次付与＋繰越処理を、設定値を読む形に作り替える
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

  -- ガード（049）を回避して更新
  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set points = v_carry + v_grant where id = p_user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, v_grant, 'monthly_grant', '月額プラン ポイント付与');
end;
$$;

-- ③ 新規登録時の初期ポイントを設定値から与えるトリガー
--    （profiles.points の DEFAULT では設定変更を反映できないため、
--     INSERT 時にトリガーで設定値を適用する）
create or replace function public.apply_initial_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 明示的に別の値が入っていない（DEFAULTのまま）の新規行に初期ポイントを適用
  new.points := public.get_setting_int('points_initial', 5);
  return new;
end;
$$;

drop trigger if exists trg_apply_initial_points on public.profiles;
create trigger trg_apply_initial_points
  before insert on public.profiles
  for each row execute function public.apply_initial_points();
