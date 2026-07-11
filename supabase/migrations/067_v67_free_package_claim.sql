-- =============================================
-- TeaNote v67 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- point_packages の price_yen = 0 のプランを「無料配布」として扱い、
-- ボタンを押すと即座にポイントが付与される機能。
-- 同一プラン・同一期間内は1人1回のみ（period_key で判定）。
-- 期間限定プラン（is_limited）は limited_until が更新されるたびに
-- period_key が変わるため、期限を更新すると再度受け取れるようになる。
-- 期間限定でない無料プランは 'permanent' を period_key とし、生涯1回のみ。

create table if not exists public.point_package_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.point_packages(id) on delete cascade,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  unique (user_id, package_id, period_key)
);

alter table public.point_package_claims enable row level security;

-- 閲覧: 本人のみ（受け取り済みかどうかの判定に使う）
drop policy if exists "claims_select" on public.point_package_claims;
create policy "claims_select" on public.point_package_claims
  for select using (auth.uid() = user_id);

-- insert/update/delete はクライアントから直接不可（claim_free_package 関数経由のみ）

-- 無料配布プランを受け取るための関数。
-- ・price_yen = 0 のプランのみ対象
-- ・is_limited かつ期限切れなら不可
-- ・同一 period_key で既に受け取り済みなら不可
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

  -- 期間限定プランは限定終了日時を period_key に使う（更新されると新しい期間として再度受け取り可能）
  v_period := case when v_pkg.is_limited then v_pkg.limited_until::text else 'permanent' end;

  begin
    insert into public.point_package_claims (user_id, package_id, period_key)
    values (v_uid, p_package_id, v_period);
  exception when unique_violation then
    return json_build_object('success', false, 'message', 'このプランは既に受け取り済みです');
  end;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles set points = points + v_pkg.points where id = v_uid;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (v_uid, v_pkg.points, 'purchase', v_pkg.label || '（無料配布）');

  return json_build_object('success', true, 'points', v_pkg.points);
end;
$$;

grant execute on function public.claim_free_package(uuid) to authenticated;
