-- =============================================
-- TeaNote v33 マイグレーション（ポイント履歴・月額課金の土台）
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① サブスク状態フラグ（Stripe等のWebhookが更新する想定。現時点では手動管理）
alter table public.profiles
  add column if not exists is_subscribed boolean not null default false;

-- ② ポイント取引履歴テーブル
--    付与・購入・消費・繰越失効をすべて記録する（問い合わせ対応・監査用）
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null, -- 正=付与/購入、負=消費/繰越失効
  type text not null check (type in ('monthly_grant', 'purchase', 'consumption', 'carryover_expiry', 'admin_adjust')),
  description text,
  created_at timestamptz not null default now()
);

alter table public.points_ledger enable row level security;

create policy "points_ledger_select_own" on public.points_ledger
  for select using (auth.uid() = user_id);

create policy "points_ledger_select_admin" on public.points_ledger
  for select using (public.is_current_user_admin());
-- insert/update/deleteポリシーは意図的に用意しない
-- （SECURITY DEFINER関数経由のみ書き込み可能にし、クライアントからの直接操作を防ぐ）

-- ③ consume_points() を履歴記録つきに更新
--    p_feature: どの機能で消費したか（例: 'advisor', 'recommend'）。任意項目。
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

  update public.profiles
  set points = points - p_amount
  where id = auth.uid() and points >= p_amount
  returning points into v_points;

  if v_points is null then
    select points into v_points from public.profiles where id = auth.uid();
    return query select false, coalesce(v_points, 0), 'ポイントが不足しています。';
    return;
  end if;

  insert into public.points_ledger(user_id, amount, type, description)
  values (auth.uid(), -p_amount, 'consumption', p_feature);

  return query select true, v_points, 'ok';
end;
$$;

-- ④ 月次付与＋繰越処理
--    ルール：残高が10ptを超えていれば10ptに切り捨て（超過分は失効として記録）→ その上に10pt付与
--    最大で「繰越10pt + 新規10pt = 20pt」まで到達しうる。
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

  if v_overflow > 0 then
    insert into public.points_ledger(user_id, amount, type, description)
    values (p_user_id, -v_overflow, 'carryover_expiry', '繰越上限（10pt）超過分の失効');
  end if;

  update public.profiles set points = v_carry + 10 where id = p_user_id;

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, 10, 'monthly_grant', '月額プラン ポイント付与');
end;
$$;

-- ⑤ 全サブスク会員への月次一括付与（Stripe Webhook or pg_cron から呼び出す想定）
--    直接クライアントから呼べないよう、サービスロール／管理者のみ実行可能にする
create or replace function public.process_all_monthly_grants()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_current_user_admin() then
    raise exception '権限がありません。' using errcode = 'P0001';
  end if;

  perform public.process_monthly_grant(id)
  from public.profiles
  where is_subscribed = true;
end;
$$;

revoke execute on function public.process_all_monthly_grants() from anon;
grant execute on function public.process_all_monthly_grants() to authenticated;

-- ⑥ ポイント購入の付与関数（将来Stripe Webhook用のEdge Functionから呼び出す想定）
--    クライアントから直接呼べないよう、auth.uid() が NULL（サービスロール経由）の場合のみ許可。
--    ※ 今回はUIモックのみのため、実際にはまだどこからも呼び出されない。
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

  update public.profiles set points = points + p_amount where id = p_user_id;

  insert into public.points_ledger(user_id, amount, type, description)
  values (p_user_id, p_amount, 'purchase', p_description);
end;
$$;

revoke execute on function public.grant_purchased_points(uuid, int, text) from anon, authenticated;

-- ⑦ 参考：pg_cronで毎月1日に自動実行する場合の例（pg_cron拡張が有効な場合のみ）
-- select cron.schedule('monthly-points-grant', '0 0 1 * *', $$select public.process_all_monthly_grants()$$);
