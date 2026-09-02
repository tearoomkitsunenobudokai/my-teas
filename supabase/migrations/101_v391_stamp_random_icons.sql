-- =============================================
-- My-Teas v391 マイグレーション
-- ログインスタンプの絵柄を抽選式にする。
--
-- 仕組み:
--   ・カードを1枚始めるときに、絵柄の候補から3種類を抽選して stamp_pool に保存
--   ・毎日、その3種類の中から1つ引いて stamp_icons に積む
--   ・カードが埋まったとき、全部同じ絵柄なら「そろい」ボーナス
--   ・カード達成時に両方リセットし、次のカードで候補を引き直す
--
-- 抽選をサーバー側で行うのは、クライアントに任せると
-- 当たりが出るまで引き直せてしまうため。
--
-- 100 の record_login_and_grant_v2() は残します（切り戻し用）。
-- Supabase SQL Editor で実行してください。
-- =============================================

alter table public.profiles
  add column if not exists stamp_pool  text[],
  add column if not exists stamp_icons text[];

comment on column public.profiles.stamp_pool is
  'いま進行中のスタンプカードで使う絵柄の候補（v391〜）';
comment on column public.profiles.stamp_icons is
  'いま進行中のスタンプカードで、実際に引いた絵柄を古い順に並べたもの（v391〜）';

-- そろいボーナスのポイント数。0にすると演出だけでポイントは付かない。
insert into public.app_settings (key, value, description)
values ('login_jackpot_points', '10',
        'ログインスタンプが全部同じ絵柄でそろったときの追加ポイント（0で演出のみ）')
on conflict (key) do nothing;

-- 1枚のカードで使う絵柄の種類数。減らすほど「そろい」が出やすくなる。
--   3種類 … 5マスなら約81枚に1回
--   4種類 … 約256枚に1回
insert into public.app_settings (key, value, description)
values ('login_stamp_pool_size', '3',
        '1枚のスタンプカードで使う絵柄の種類数（少ないほど「そろい」が出やすい）')
on conflict (key) do nothing;

-- 絵柄の全候補。フロントの src/lib/stampIcons.ts と対応させること。
create or replace function public.stamp_icon_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'leaf', 'milk', 'teabag', 'sugar', 'pot',
    'lemon', 'powder', 'honey', 'diluted', 'ice'
  ]
$$;

create or replace function public.record_login_and_grant_v3()
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
  v_jackpot_pts int;
  v_pool_size int;
  v_granted int := 0;
  v_jackpot boolean := false;
  v_before int;
  v_pool text[];
  v_icons text[];
  v_drawn text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select last_login_date, login_count, stamp_pool, stamp_icons
    into v_last, v_count, v_pool, v_icons
  from public.profiles where id = auth.uid();

  v_need        := public.get_setting_int('login_bonus_days', 5);
  v_bonus       := public.get_setting_int('login_bonus_points', 2);
  v_jackpot_pts := public.get_setting_int('login_jackpot_points', 10);
  v_pool_size   := public.get_setting_int('login_stamp_pool_size', 3);
  v_before      := coalesce(v_count, 0);

  -- 今日はもう押している場合。抽選せず、いまの状態だけ返す。
  if v_last is not null and v_last >= v_today then
    return json_build_object(
      'stamped', false, 'granted', 0, 'jackpot', false,
      'count', v_before, 'need', v_need, 'bonus', v_bonus,
      'icons', coalesce(v_icons, array[]::text[]),
      'pool',  coalesce(v_pool,  array[]::text[])
    );
  end if;

  -- カードの最初の1個なら、絵柄の候補を引き直す。
  -- 途中でズレた場合（設定変更など）もここで作り直す。
  if v_before = 0 or v_pool is null or array_length(v_pool, 1) is null then
    select array_agg(k) into v_pool
    from (
      select unnest(public.stamp_icon_keys()) as k
      order by random()
      limit greatest(1, v_pool_size)
    ) t;
    v_icons := array[]::text[];
  end if;

  -- 候補から1つ引く
  v_drawn := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
  v_icons := coalesce(v_icons, array[]::text[]) || v_drawn;

  v_count := v_before + 1;

  if v_count >= v_need then
    -- 全部同じ絵柄かどうか
    v_jackpot := (select count(distinct x) = 1 from unnest(v_icons) as x);
    v_granted := v_bonus + (case when v_jackpot then v_jackpot_pts else 0 end);

    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set login_count = 0, last_login_date = v_today,
          stamp_pool = null, stamp_icons = null
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);

    if v_granted > 0 then
      perform public.grant_free_points(
        auth.uid(), v_granted,
        case when v_jackpot
             then 'ログインボーナス（' || v_need || '日達成＋絵柄そろい）'
             else 'ログインボーナス（' || v_need || '日達成）' end,
        null, 'daily_login');
    end if;

    -- 達成時はカードが埋まった様子を見せたいので、count には need を返す。
    return json_build_object(
      'stamped', true, 'granted', v_granted, 'jackpot', v_jackpot,
      'count', v_need, 'need', v_need, 'bonus', v_bonus,
      'icons', v_icons, 'pool', v_pool
    );
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update public.profiles
    set login_count = v_count, last_login_date = v_today,
        stamp_pool = v_pool, stamp_icons = v_icons
    where id = auth.uid();
  perform set_config('app.bypass_profile_guard', 'off', true);

  return json_build_object(
    'stamped', true, 'granted', 0, 'jackpot', false,
    'count', v_count, 'need', v_need, 'bonus', v_bonus,
    'icons', v_icons, 'pool', v_pool
  );
end;
$$;

grant execute on function public.record_login_and_grant_v3() to authenticated;

comment on function public.record_login_and_grant_v3() is
  'ログインを記録し、抽選した絵柄を含むスタンプの結果を返す（v391〜）';
