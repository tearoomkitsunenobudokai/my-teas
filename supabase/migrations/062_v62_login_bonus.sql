-- =============================================
-- TeaNote v62 マイグレーション（ログインボーナス）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 累計5日ログインで2ポイント付与する。付与後はカウントをリセットして繰り返す。
-- 「1日1回まで」を守るため、最後にログインした日と今日を比較して判定する。

-- ① ログイン日数カウントと最終ログイン日を profiles に追加
alter table public.profiles add column if not exists login_count int not null default 0;
alter table public.profiles add column if not exists last_login_date date;

-- ② points_ledger の type に 'daily_login' を追加
alter table public.points_ledger drop constraint if exists points_ledger_type_check;
alter table public.points_ledger add constraint points_ledger_type_check
  check (type in ('monthly_grant', 'purchase', 'consumption', 'carryover_expiry', 'admin_adjust', 'daily_login'));

-- ③ 設定値（付与に必要なログイン日数・付与ポイント数）
insert into public.app_settings (key, value, description) values
  ('login_bonus_days',   '5', 'ログインボーナス付与に必要な累計ログイン日数'),
  ('login_bonus_points', '2', 'ログインボーナスで付与されるポイント数')
on conflict (key) do nothing;

-- ④ ログインを記録し、条件を満たせばボーナスを付与する関数
--    アプリを開いたとき（ログイン時）に1回呼ぶ。日付が変わっていなければ何もしない。
--    戻り値: 今回ボーナスを付与したら付与ポイント数、しなければ 0
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
  v_today date := (now() at time zone 'Asia/Tokyo')::date;  -- 日本時間で「今日」を判定
begin
  select last_login_date, login_count into v_last, v_count
  from public.profiles where id = auth.uid();

  -- 今日すでにログイン記録済みなら何もしない
  if v_last is not null and v_last >= v_today then
    return 0;
  end if;

  v_need  := public.get_setting_int('login_bonus_days', 5);
  v_bonus := public.get_setting_int('login_bonus_points', 2);
  v_count := coalesce(v_count, 0) + 1;

  -- 必要日数に達したらボーナス付与＆カウントリセット
  if v_count >= v_need then
    v_granted := v_bonus;
    v_count := 0;

    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set points = points + v_bonus, login_count = v_count, last_login_date = v_today
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);

    insert into public.points_ledger(user_id, amount, type, description)
    values (auth.uid(), v_bonus, 'daily_login', 'ログインボーナス（' || v_need || '日達成）');
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
