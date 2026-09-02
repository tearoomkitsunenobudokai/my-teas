-- =============================================
-- My-Teas v390 マイグレーション
-- ログイン記録の結果を、画面で演出できるだけの情報付きで返す関数を追加する。
--
-- 既存の record_login_and_grant()（戻り値 int）はそのまま残します。
-- 戻り値の型が変わると古いフロントが壊れるため、新しい関数を別名で追加し、
-- 中身のロジックは 077 の実装をそのまま踏襲しています。
-- 動作が安定したら、後日 record_login_and_grant() を削除してください。
--
-- Supabase SQL Editor で実行してください。
-- =============================================

create or replace function public.record_login_and_grant_v2()
returns json
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
  v_before int;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select last_login_date, login_count into v_last, v_count
  from public.profiles where id = auth.uid();

  v_need  := public.get_setting_int('login_bonus_days', 5);
  v_bonus := public.get_setting_int('login_bonus_points', 2);
  v_before := coalesce(v_count, 0);

  -- 今日はもう押している場合。押していないことが分かるよう stamped=false で返す。
  if v_last is not null and v_last >= v_today then
    return json_build_object(
      'stamped', false,
      'granted', 0,
      'count',   v_before,
      'need',    v_need,
      'bonus',   v_bonus
    );
  end if;

  v_count := v_before + 1;

  if v_count >= v_need then
    v_granted := v_bonus;
    v_count := 0;

    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set login_count = v_count, last_login_date = v_today
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);

    perform public.grant_free_points(auth.uid(), v_granted,
      'ログインボーナス（' || v_need || '日達成）', null, 'daily_login');

    -- 達成時は、カードが満タンになった様子を見せたいので count には need を返す。
    -- 実際の login_count は 0 にリセット済み。
    return json_build_object(
      'stamped', true,
      'granted', v_granted,
      'count',   v_need,
      'need',    v_need,
      'bonus',   v_bonus
    );
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set login_count = v_count, last_login_date = v_today
    where id = auth.uid();
  perform set_config('app.bypass_profile_guard', 'off', true);

  return json_build_object(
    'stamped', true,
    'granted', 0,
    'count',   v_count,
    'need',    v_need,
    'bonus',   v_bonus
  );
end;
$$;

grant execute on function public.record_login_and_grant_v2() to authenticated;

comment on function public.record_login_and_grant_v2() is
  'ログインを記録し、スタンプの押下結果を返す（v390〜）。'
  'stamped=今日スタンプを押したか / count=押した後の個数 / need=必要数 / granted=付与ポイント';
