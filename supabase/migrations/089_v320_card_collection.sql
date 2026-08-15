-- =============================================
-- My-Teas v320 マイグレーション（評価カードの収集）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 概要:
--   コミュニティに公開されている他の人の評価から、ポイントを消費して
--   「集めたカード（COLLECTION版）」を作れるようにする。
--
-- 悪用対策の考え方:
--   捨てアカウントを大量に作り、新規登録特典の無料ポイントで他人のカードを
--   集めて回る、という使われ方を防ぐ必要がある。
--   ただし現時点では Stripe 決済が未接続で、正規の手段で課金ポイント（paid）を
--   得たユーザーが存在しないため、「課金ポイント限定」にすると
--   v76 の移行で paid 扱いになった古いユーザーしか使えない状態になる。
--   そこで次の4つの条件をすべて app_settings で調整できるようにし、
--   決済を接続したあとで「課金限定」へ切り替えられる形にしている。
--
--     card_collect_min_reviews     … 自分が投稿した評価の最低件数
--     card_collect_min_account_days… 登録からの最低経過日数
--     card_collect_daily_limit     … 1日に集められる上限枚数
--     card_collect_paid_only       … 課金ポイントでのみ消費する（決済接続後に true へ）
--
--   なお「集められた側にポイントを還元する」ことは意図的に行っていない。
--   複数アカウントで互いに集め合えばポイントを無限に増やせてしまうため。

-- ① 集めたカードの記録
create table if not exists public.review_card_collections (
  id uuid primary key default gen_random_uuid(),
  -- 集めた人
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 集めた対象の評価
  review_id uuid not null references public.reviews(id) on delete cascade,
  -- 集めた時点で支払ったポイント（あとから料金を変えても履歴が残るように）
  cost int not null default 0,
  collected_at timestamptz not null default now(),
  -- 同じ評価は一度だけ。2回目以降は再ダウンロード扱いで無料にする
  unique (user_id, review_id)
);

alter table public.review_card_collections enable row level security;

-- 自分が集めたものだけ見られる
drop policy if exists "rcc_select_own" on public.review_card_collections;
create policy "rcc_select_own" on public.review_card_collections
  for select using (auth.uid() = user_id);

drop policy if exists "rcc_select_admin" on public.review_card_collections;
create policy "rcc_select_admin" on public.review_card_collections
  for select using (public.is_current_user_admin());

-- 自分で削除（コレクションから外す）ことはできる
drop policy if exists "rcc_delete_own" on public.review_card_collections;
create policy "rcc_delete_own" on public.review_card_collections
  for delete using (auth.uid() = user_id);

-- insert はクライアントから直接行わせない（collect_review_card 経由のみ）

create index if not exists idx_rcc_user_collected
  on public.review_card_collections (user_id, collected_at desc);
create index if not exists idx_rcc_review
  on public.review_card_collections (review_id);

-- ② 評価する側が「自分のカードを集めさせない」を選べるようにする
--    既定は許可（true）。公開している評価は元々コミュニティで見えているため。
alter table public.reviews
  add column if not exists allow_card_export boolean not null default true;

comment on column public.reviews.allow_card_export is
  '他のユーザーがこの評価のカードを集めることを許可するか。falseにすると収集できなくなる。';

-- ③ 設定値
insert into public.app_settings (key, value, description) values
  ('card_collect_min_reviews', '5',
   'カード収集を使うために必要な、自分の評価の最低件数（捨てアカウント対策）'),
  ('card_collect_min_account_days', '7',
   'カード収集を使うために必要な、登録からの最低経過日数（捨てアカウント対策）'),
  ('card_collect_daily_limit', '5',
   '1日に集められるカードの上限枚数'),
  ('card_collect_paid_only', 'false',
   '課金ポイントでのみカード収集を許可するか。決済を接続したあと true にする')
on conflict (key) do nothing;

-- ④ 料金（feature_costs）。開発中は0のため無料。
--    管理画面「💎 ポイント設定」から変更できる。
insert into public.feature_costs (feature, cost, label, sort_order) values
  ('card_collect', 0, 'カードを集める', 6)
on conflict (feature) do nothing;

-- ⑤ 文字列設定を真偽値で読むための補助
create or replace function public.get_setting_bool(p_key text, p_default boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  select value into v from public.app_settings where key = p_key;
  if v is null then return p_default; end if;
  return lower(trim(v)) in ('true', 't', '1', 'yes', 'on');
end;
$$;

grant execute on function public.get_setting_bool(text, boolean) to authenticated;

-- ⑥ 課金ポイントのみを消費する関数
--    consume_points と同じ返り値だが、free ロットには一切手を付けない。
create or replace function public.consume_paid_points(p_amount int, p_feature text default null)
returns table(success boolean, remaining int, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exempt boolean;
  v_points int;
  v_paid int;
  v_remaining int;
  v_lot record;
  v_take int;
begin
  select (is_admin or is_creator) into v_exempt
  from public.profiles where id = auth.uid();

  if v_exempt is true then
    select points into v_points from public.profiles where id = auth.uid();
    return query select true, coalesce(v_points, 0), '製作者/管理者はポイント消費なし';
    return;
  end if;

  if p_amount <= 0 then
    select points into v_points from public.profiles where id = auth.uid();
    return query select true, coalesce(v_points, 0), 'ok';
    return;
  end if;

  perform public.sweep_expired_free_points(auth.uid());

  select points, points_paid into v_points, v_paid
  from public.profiles where id = auth.uid();

  if coalesce(v_paid, 0) < p_amount then
    return query select false, coalesce(v_points, 0),
      '購入したポイントが不足しています。（この機能は無料ポイントでは利用できません）';
    return;
  end if;

  v_remaining := p_amount;

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
  end loop;

  if v_remaining > 0 then
    return query select false, coalesce(v_points, 0), '購入したポイントが不足しています。';
    return;
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set points = points - p_amount,
        points_paid = greatest(0, points_paid - p_amount)
    where id = auth.uid()
    returning points into v_points;
  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into public.points_ledger(user_id, amount, type, description)
  values (auth.uid(), -p_amount, 'consumption', p_feature);

  return query select true, v_points, 'ok';
end;
$$;

grant execute on function public.consume_paid_points(int, text) to authenticated;

-- ⑦ 収集できるかどうかを判定する（ボタンの状態を出し分けるために使う）
--    ポイントは減らさない。純粋な判定のみ。
create or replace function public.can_collect_card(p_review_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exempt boolean;
  v_review record;
  v_my_reviews int;
  v_days int;
  v_today_count int;
  v_min_reviews int;
  v_min_days int;
  v_daily_limit int;
  v_paid_only boolean;
  v_cost int;
  v_already boolean;
  v_created timestamptz;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'auth', 'message', 'ログインが必要です');
  end if;

  select r.id, r.user_id, r.is_public, r.allow_card_export
    into v_review
  from public.reviews r where r.id = p_review_id;

  if not found then
    return json_build_object('ok', false, 'reason', 'not_found', 'message', '評価が見つかりません');
  end if;

  -- 自分の評価は、この機能を使わず通常のカード作成から作れる
  if v_review.user_id = v_uid then
    return json_build_object('ok', false, 'reason', 'own',
      'message', '自分の評価は「カード画像を作成」から無料で作れます');
  end if;

  if v_review.is_public is not true then
    return json_build_object('ok', false, 'reason', 'private', 'message', '公開されていない評価です');
  end if;

  if v_review.allow_card_export is not true then
    return json_build_object('ok', false, 'reason', 'not_allowed',
      'message', 'この評価は、投稿した人がカードの収集を許可していません');
  end if;

  -- すでに集めていれば、追加のポイントなしで作り直せる
  select exists(
    select 1 from public.review_card_collections
    where user_id = v_uid and review_id = p_review_id
  ) into v_already;

  if v_already then
    return json_build_object('ok', true, 'reason', 'already', 'cost', 0,
      'message', '収集済みのカードです（ポイントは消費しません）');
  end if;

  select (is_admin or is_creator), created_at into v_exempt, v_created
  from public.profiles where id = v_uid;

  v_min_reviews := public.get_setting_int('card_collect_min_reviews', 5);
  v_min_days    := public.get_setting_int('card_collect_min_account_days', 7);
  v_daily_limit := public.get_setting_int('card_collect_daily_limit', 5);
  v_paid_only   := public.get_setting_bool('card_collect_paid_only', false);
  v_cost        := coalesce((select cost from public.feature_costs where feature = 'card_collect'), 0);

  -- 管理者・製作者は条件の対象外（動作確認のため）
  if v_exempt is not true then
    -- 捨てアカウント対策 その1: 自分でも記録していること
    select count(*) into v_my_reviews from public.reviews where user_id = v_uid;
    if v_my_reviews < v_min_reviews then
      return json_build_object('ok', false, 'reason', 'min_reviews', 'need', v_min_reviews,
        'have', v_my_reviews,
        'message', '自分の評価を' || v_min_reviews || '件以上記録すると使えるようになります（現在' || v_my_reviews || '件）');
    end if;

    -- 捨てアカウント対策 その2: 登録直後は使えない
    v_days := floor(extract(epoch from (now() - coalesce(v_created, now()))) / 86400);
    if v_days < v_min_days then
      return json_build_object('ok', false, 'reason', 'min_days', 'need', v_min_days,
        'message', '登録から' || v_min_days || '日経過後に使えるようになります');
    end if;

    -- 集めすぎの抑制
    select count(*) into v_today_count
    from public.review_card_collections
    where user_id = v_uid
      and collected_at >= date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';

    if v_today_count >= v_daily_limit then
      return json_build_object('ok', false, 'reason', 'daily_limit', 'need', v_daily_limit,
        'message', '1日に集められるのは' || v_daily_limit || '枚までです。明日またお試しください');
    end if;
  end if;

  return json_build_object('ok', true, 'reason', 'ok', 'cost', v_cost,
    'paid_only', v_paid_only,
    'message', 'ok');
end;
$$;

grant execute on function public.can_collect_card(uuid) to authenticated;

-- ⑧ 実際に収集する（判定 → ポイント消費 → 記録 をひとつの処理にまとめる）
--    判定と消費を分けるとクライアント側で判定だけ回避できてしまうため、
--    ここでも同じ条件を必ず再確認している。
create or replace function public.collect_review_card(p_review_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_check json;
  v_cost int;
  v_paid_only boolean;
  v_res record;
begin
  v_check := public.can_collect_card(p_review_id);

  if (v_check->>'ok')::boolean is not true then
    return json_build_object('success', false, 'message', v_check->>'message');
  end if;

  -- すでに集めていれば消費なしでそのまま許可する
  if v_check->>'reason' = 'already' then
    return json_build_object('success', true, 'cost', 0, 'already', true, 'message', 'ok');
  end if;

  v_cost      := coalesce((v_check->>'cost')::int, 0);
  v_paid_only := coalesce((v_check->>'paid_only')::boolean, false);

  if v_cost > 0 then
    if v_paid_only then
      select * into v_res from public.consume_paid_points(v_cost, 'card_collect');
    else
      select * into v_res from public.consume_points(v_cost, 'card_collect');
    end if;

    if v_res.success is not true then
      return json_build_object('success', false, 'message', v_res.message);
    end if;
  end if;

  begin
    insert into public.review_card_collections (user_id, review_id, cost)
    values (v_uid, p_review_id, v_cost);
  exception when unique_violation then
    -- 二重送信された場合。ポイントは既に引かれているので払い戻す
    if v_cost > 0 then
      perform public.grant_paid_points(v_uid, v_cost, 'カード収集の重複による返却');
    end if;
    return json_build_object('success', true, 'cost', 0, 'already', true, 'message', 'ok');
  end;

  return json_build_object('success', true, 'cost', v_cost, 'already', false,
    'remaining', coalesce(v_res.remaining, null), 'message', 'ok');
end;
$$;

grant execute on function public.collect_review_card(uuid) to authenticated;

-- ⑨ 集めたカードを一覧するためのビュー
--    公開評価のうち、自分が集めたものだけを、カード生成に必要な列とともに返す。
create or replace view public.my_collected_cards
with (security_invoker = true)
as
select
  c.id            as collection_id,
  c.collected_at,
  c.cost,
  r.id            as review_id,
  r.tea_name, r.brand_name, r.shop_name, r.tea_garden, r.origin_country,
  r.color_hex, r.aroma_notes, r.comment, r.drank_at,
  r.brew_method, r.steep_seconds, r.tea_grams_per_100ml, r.tea_grams, r.water_ml,
  r.accompaniments,
  r.score_aroma, r.score_astringency, r.score_richness, r.score_color_depth,
  r.user_id       as author_id,
  p.name          as author_name
from public.review_card_collections c
join public.reviews r on r.id = c.review_id
left join public.public_profiles p on p.id = r.user_id
where c.user_id = auth.uid();

grant select on public.my_collected_cards to authenticated;

-- ⑩ スキーマキャッシュの更新
notify pgrst, 'reload schema';
