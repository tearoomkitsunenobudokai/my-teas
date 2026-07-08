-- =============================================
-- TeaNote v32 マイグレーション（AI分析ポイント制）
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① ポイントカラムを追加（デフォルト5pt）
alter table public.profiles
  add column if not exists points integer not null default 5;

-- ADD CONSTRAINT に IF NOT EXISTS は使えないため、DOブロックで安全に追加する
-- （詳細は032b_v32b_fix_points_constraint.sql参照）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_points_nonnegative'
  ) then
    alter table public.profiles
      add constraint profiles_points_nonnegative check (points >= 0);
  end if;
end $$;

-- ② ポイント消費関数
--    - 製作者・管理者は消費対象外（残高チェックなしで常に成功を返す）
--    - 残高不足の場合は success = false を返し、呼び出し側でブロックする
--    - auth.uid() 基準で動作するため、他人のポイントを操作することはできない
create or replace function public.consume_points(p_amount int)
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

  update public.profiles
  set points = points - p_amount
  where id = auth.uid() and points >= p_amount
  returning points into v_points;

  if v_points is null then
    select points into v_points from public.profiles where id = auth.uid();
    return query select false, coalesce(v_points, 0), 'ポイントが不足しています。';
    return;
  end if;

  return query select true, v_points, 'ok';
end;
$$;

revoke execute on function public.consume_points(int) from anon;
grant execute on function public.consume_points(int) to authenticated;
