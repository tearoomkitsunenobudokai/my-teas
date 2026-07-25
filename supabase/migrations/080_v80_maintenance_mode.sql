-- =============================================
-- TeaNote v80 マイグレーション（メンテナンスモード）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 3つのモードを用意する。切り替えは製作者のみ（管理画面から）。
--   off      … 通常運転
--   readonly … 閲覧のみ可。新規登録・編集・削除をDBレベルで拒否する
--   full     … 全面停止。一般ユーザーはアプリを使えず、強制的にログアウトされる
--
-- 重要: readonly の書き込み拒否は「DB側のトリガー」で行う。
-- 画面側だけで制御すると、APIを直接叩けば書き込めてしまうため。
-- 製作者・管理者はメンテナンス中も書き込みできる（復旧作業のため）。

-- ① 設定値
insert into public.app_settings (key, value, description) values
  ('maintenance_mode', 'off', 'メンテナンスモード: off / readonly（閲覧のみ）/ full（全面停止）'),
  ('maintenance_message', 'ただいまメンテナンス中です。しばらく経ってから再度お試しください。',
   'メンテナンス中に表示するメッセージ')
on conflict (key) do nothing;

-- ② 現在のモードを返す関数（未ログインでも参照できるようにする）
create or replace function public.get_maintenance_mode()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select value from public.app_settings where key = 'maintenance_mode'), 'off');
$$;

grant execute on function public.get_maintenance_mode() to anon, authenticated;

create or replace function public.get_maintenance_message()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select value from public.app_settings where key = 'maintenance_message'), '');
$$;

grant execute on function public.get_maintenance_message() to anon, authenticated;

-- ③ 書き込みを拒否するトリガー関数
--    メンテナンス中（readonly / full）は、製作者・管理者以外の書き込みを止める。
create or replace function public.enforce_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_privileged boolean;
begin
  v_mode := public.get_maintenance_mode();
  if v_mode = 'off' then
    return coalesce(new, old);
  end if;

  -- 製作者・管理者は作業のため書き込み可
  select coalesce(is_admin or is_creator, false) into v_privileged
  from public.profiles where id = auth.uid();

  if v_privileged is true then
    return coalesce(new, old);
  end if;

  raise exception 'ただいまメンテナンス中のため、データの変更はできません。'
    using errcode = 'P0001';
end;
$$;

-- ④ ユーザーが書き込む主なテーブルにトリガーを設定
do $$
declare
  t text;
  tables text[] := array[
    'reviews', 'tea_colors', 'review_wants', 'shop_bookmarks',
    'shop_visits', 'omikuji_draws', 'advisor_history', 'review_publish_log'
  ];
begin
  foreach t in array tables loop
    -- 対象テーブルが存在する場合のみ設定する
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('drop trigger if exists trg_maintenance_guard on public.%I', t);
      execute format(
        'create trigger trg_maintenance_guard
           before insert or update or delete on public.%I
           for each row execute function public.enforce_maintenance()', t);
    end if;
  end loop;
end $$;

-- ⑤ ポイント消費もメンテナンス中は止める（AI機能を使わせない）
--    consume_points は security definer なのでトリガーの影響を受けないため、明示的に確認する。
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
  v_mode text;
begin
  select (is_admin or is_creator) into v_exempt
  from public.profiles where id = auth.uid();

  -- メンテナンス中は製作者・管理者以外はポイントを消費できない
  v_mode := public.get_maintenance_mode();
  if v_mode <> 'off' and v_exempt is not true then
    select points into v_points from public.profiles where id = auth.uid();
    return query select false, coalesce(v_points, 0), 'ただいまメンテナンス中のため、この機能は利用できません。';
    return;
  end if;

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

-- ⑥ モードを切り替える関数（製作者のみ実行可）
create or replace function public.set_maintenance_mode(p_mode text, p_message text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_creator boolean;
begin
  select coalesce(is_creator, false) into v_is_creator
  from public.profiles where id = auth.uid();

  if v_is_creator is not true then
    raise exception '製作者のみ実行できます。';
  end if;

  if p_mode not in ('off', 'readonly', 'full') then
    raise exception 'モードは off / readonly / full のいずれかです。';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('maintenance_mode', p_mode, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if p_message is not null then
    insert into public.app_settings (key, value, updated_at)
    values ('maintenance_message', p_message, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  return p_mode;
end;
$$;

grant execute on function public.set_maintenance_mode(text, text) to authenticated;
