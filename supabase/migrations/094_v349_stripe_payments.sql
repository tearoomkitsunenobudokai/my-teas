-- =============================================
-- My-Teas v349 マイグレーション（Stripe決済の受け口）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- ポイントの都度購入をStripeで受け付けるための土台。
--
-- 設計の要点:
--   ・金額とポイント数は、必ずサーバー側で point_packages から読む。
--     ブラウザから送られた金額を信じると、書き換えて安く買われてしまう。
--   ・決済1件につき1行だけ記録し、session_id に一意制約を張る。
--     Stripe は同じ通知を複数回送ることがあるため（再送・タイムアウト時など）、
--     これが無いと1回の支払いで何度もポイントが付いてしまう。
--   ・付与そのものは既存の grant_purchased_points() を使う。
--     この関数は security definer で、一般ユーザーからは実行できない。

create table if not exists public.stripe_payments (
  id uuid primary key default gen_random_uuid(),
  -- Stripe の決済セッションID。二重付与を防ぐ鍵になる
  session_id text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid references public.point_packages(id) on delete set null,
  -- 購入時点の内容を控える（あとから価格やプラン名を変えても履歴が残るように）
  package_label text,
  points int not null,
  amount_yen int not null,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  paid_at timestamptz not null default now()
);

alter table public.stripe_payments enable row level security;

-- 自分の購入履歴だけ見られる
drop policy if exists "stripe_payments_select_own" on public.stripe_payments;
create policy "stripe_payments_select_own" on public.stripe_payments
  for select using (auth.uid() = user_id);

drop policy if exists "stripe_payments_select_admin" on public.stripe_payments;
create policy "stripe_payments_select_admin" on public.stripe_payments
  for select using (public.is_current_user_admin());

-- 書き込みはサーバー側（サービスロール）からのみ。ポリシーは作らない。

create index if not exists idx_stripe_payments_user
  on public.stripe_payments (user_id, paid_at desc);

-- 決済完了の記録とポイント付与を、ひとまとめで行う。
-- すでに同じ session_id が記録されていれば何もしない（二重付与の防止）。
create or replace function public.record_stripe_payment(
  p_session_id text,
  p_user_id uuid,
  p_package_id uuid,
  p_package_label text,
  p_points int,
  p_amount_yen int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.stripe_payments
    (session_id, user_id, package_id, package_label, points, amount_yen)
  values
    (p_session_id, p_user_id, p_package_id, p_package_label, p_points, p_amount_yen)
  on conflict (session_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- すでに処理済み。Stripeからの再送なので、成功として返す
    return json_build_object('success', true, 'already', true);
  end if;

  perform public.grant_purchased_points(
    p_user_id, p_points, coalesce(p_package_label, 'ポイント購入')
  );

  return json_build_object('success', true, 'already', false);
end;
$$;

-- 一般ユーザーからは実行させない（Webhookがサービスロールで呼ぶ）
revoke execute on function public.record_stripe_payment(text, uuid, uuid, text, int, int)
  from anon, authenticated;

notify pgrst, 'reload schema';
