-- =============================================
-- My-Teas v392 マイグレーション
-- ログインスタンプに「役」（ポーカー風）を導入する。
--
-- 5マス・候補5種類のときの出現率:
--   five      ファイブカード（5個そろい）  0.16%   625枚に1回 ≒ 8.6年
--   four      フォーカード（4個そろい）    3.20%    31枚に1回 ≒ 5.2か月
--   full      フルハウス（3個＋2個）       6.40%    16枚に1回 ≒ 2.6か月
--   complete  コンプリート（全部ちがう）   3.84%    26枚に1回 ≒ 4.3か月
--   three     スリーカード                19.20%     5枚に1回
--   twopair   ツーペア                    28.80%     3枚に1回
--   none      役なし（ワンペア以下）       38.40%
--
-- 役ごとの追加ポイントは app_settings で変更できる。
-- Supabase SQL Editor で実行してください。
-- =============================================

-- 候補は5種類に変更（101では3だった）。
-- 5日・5マス・5種類でそろえている。5マス・5種類のときだけ6つの役がすべて成立し、
-- 4種類以下にすると「コンプリート（全部ちがう）」が出せなくなるため。
-- 管理画面からは変更できないようにしてあり、変えたい場合はここを直接書き換えること。
update public.app_settings set value = '5' where key = 'login_stamp_pool_size';
update public.app_settings
  set description = '1枚のスタンプカードで使う絵柄の種類数（5固定。役の成立条件に影響するため管理画面からは変更不可）'
  where key = 'login_stamp_pool_size';

-- 達成日数も5で固定する。
-- 5日・5マス・5種類でそろえており、この組み合わせのときだけ6つの役がすべて成立する。
-- 例えば3日にすると、フォーカードもコンプリートも出せなくなる。
-- 管理画面からは変更できないようにしてあり、変えたい場合はここを直接書き換えること。
update public.app_settings set value = '5' where key = 'login_bonus_days';
update public.app_settings
  set description = 'ログインボーナスの必要日数（5固定。スタンプの役の成立条件に影響するため管理画面からは変更不可）'
  where key = 'login_bonus_days';

-- 役ごとの追加ポイント。0にすると演出だけでポイントは付かない。
-- 初期値は控えめにしてある。
-- よく出る役（スリーカード・ツーペア）を0にしているのは、配りすぎを避けるため。
-- 役ボーナスの平均は 1枚あたり 0.86pt（=年間およそ63pt）で、
-- 既存の達成ボーナス2pt（年間146pt）の半分弱に収まる。
-- 緩めたい場合は値を上げてください（下の目安を参照）。
--
--   ツーペアを1ptにすると      +0.29pt/枚（年+21pt）
--   スリーカードを2ptにすると  +0.38pt/枚（年+28pt）
insert into public.app_settings (key, value, description) values
  ('stamp_hand_five',     '30', '役ボーナス：ファイブカード（5個そろい・8.6年に1回）'),
  ('stamp_hand_four',     '10', '役ボーナス：フォーカード（4個そろい・5か月に1回）'),
  ('stamp_hand_complete',  '8', '役ボーナス：コンプリート（全部ちがう・4か月に1回）'),
  ('stamp_hand_full',      '3', '役ボーナス：フルハウス（3個＋2個・2.6か月に1回）'),
  ('stamp_hand_three',     '0', '役ボーナス：スリーカード（5枚に1回・既定は演出のみ）'),
  ('stamp_hand_twopair',   '0', '役ボーナス：ツーペア（3枚に1回・既定は演出のみ）')
on conflict (key) do nothing;

/* 引いた絵柄の並びから役を判定する */
create or replace function public.stamp_hand(p_icons text[])
returns text
language plpgsql
immutable
as $$
declare
  n int[];
  total int;
begin
  if p_icons is null or array_length(p_icons, 1) is null then
    return 'none';
  end if;
  total := array_length(p_icons, 1);

  -- 同じ絵柄の個数を多い順に並べる
  select array_agg(c order by c desc) into n
  from (select count(*) as c from unnest(p_icons) as x group by x) t;

  if n[1] = total and total >= 2      then return 'five';     end if;  -- 全部同じ
  if n[1] = total - 1 and total >= 4  then return 'four';     end if;
  if n[1] = 3 and n[2] = 2            then return 'full';     end if;
  if array_length(n, 1) = total       then return 'complete'; end if;  -- 全部ちがう
  if n[1] = 3                         then return 'three';    end if;
  if n[1] = 2 and n[2] = 2            then return 'twopair';  end if;
  return 'none';
end;
$$;

/* 役に対応する追加ポイントを返す */
create or replace function public.stamp_hand_points(p_hand text)
returns int
language sql
stable
as $$
  select case p_hand
    when 'five'     then public.get_setting_int('stamp_hand_five',     30)
    when 'four'     then public.get_setting_int('stamp_hand_four',     10)
    when 'complete' then public.get_setting_int('stamp_hand_complete',  8)
    when 'full'     then public.get_setting_int('stamp_hand_full',      3)
    when 'three'    then public.get_setting_int('stamp_hand_three',     0)
    when 'twopair'  then public.get_setting_int('stamp_hand_twopair',   0)
    else 0
  end
$$;

create or replace function public.record_login_and_grant_v4()
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
  v_pool_size int;
  v_granted int := 0;
  v_hand text := 'none';
  v_hand_pts int := 0;
  v_before int;
  v_pool text[];
  v_icons text[];
  v_drawn text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select last_login_date, login_count, stamp_pool, stamp_icons
    into v_last, v_count, v_pool, v_icons
  from public.profiles where id = auth.uid();

  v_need      := public.get_setting_int('login_bonus_days', 5);
  v_bonus     := public.get_setting_int('login_bonus_points', 2);
  v_pool_size := public.get_setting_int('login_stamp_pool_size', 5);
  v_before    := coalesce(v_count, 0);

  -- 今日はもう押している場合。抽選せず、いまの状態だけ返す。
  if v_last is not null and v_last >= v_today then
    return json_build_object(
      'stamped', false, 'granted', 0, 'hand', 'none', 'handPoints', 0,
      'count', v_before, 'need', v_need, 'bonus', v_bonus,
      'icons', coalesce(v_icons, array[]::text[]),
      'pool',  coalesce(v_pool,  array[]::text[])
    );
  end if;

  -- カードの最初の1個なら、絵柄の候補を引き直す
  if v_before = 0 or v_pool is null or array_length(v_pool, 1) is null then
    select array_agg(k) into v_pool
    from (
      select unnest(public.stamp_icon_keys()) as k
      order by random()
      limit greatest(1, v_pool_size)
    ) t;
    v_icons := array[]::text[];
  end if;

  v_drawn := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
  v_icons := coalesce(v_icons, array[]::text[]) || v_drawn;
  v_count := v_before + 1;

  if v_count >= v_need then
    v_hand := public.stamp_hand(v_icons);
    v_hand_pts := public.stamp_hand_points(v_hand);
    v_granted := v_bonus + v_hand_pts;

    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles
      set login_count = 0, last_login_date = v_today,
          stamp_pool = null, stamp_icons = null
      where id = auth.uid();
    perform set_config('app.bypass_profile_guard', 'off', true);

    if v_granted > 0 then
      perform public.grant_free_points(
        auth.uid(), v_granted,
        case when v_hand = 'none'
             then 'ログインボーナス（' || v_need || '日達成）'
             else 'ログインボーナス（' || v_need || '日達成＋' || v_hand || '）' end,
        null, 'daily_login');
    end if;

    return json_build_object(
      'stamped', true, 'granted', v_granted,
      'hand', v_hand, 'handPoints', v_hand_pts,
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
    'stamped', true, 'granted', 0, 'hand', 'none', 'handPoints', 0,
    'count', v_count, 'need', v_need, 'bonus', v_bonus,
    'icons', v_icons, 'pool', v_pool
  );
end;
$$;

grant execute on function public.record_login_and_grant_v4() to authenticated;

comment on function public.record_login_and_grant_v4() is
  'ログインを記録し、カード達成時に役を判定して返す（v392〜）';
