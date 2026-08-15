-- =============================================
-- My-Teas v326 マイグレーション
-- collect_review_card を record 変数を使わない形に書き直す
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 090 でも同じエラーが出る場合の対処。
--
-- record 型の変数は、一度も代入されないまま参照するとエラーになる。
-- 分岐が増えるほど「代入されない経路」を見落としやすいため、
-- record をやめて、必要な値だけを普通の変数で受け取る形に変える。
-- これにより「未代入」というエラー自体が起こらなくなる。
--
-- 動作は 090 と同じ:
--   1. 収集できるかを判定
--   2. 先に記録を作る（重複ならポイントに触れずに終了）
--   3. 料金があればポイントを消費し、失敗したら記録を取り消す

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
  v_new_id uuid;
  -- 消費結果は record ではなく個別の変数で受け取る
  v_ok boolean := null;
  v_remaining int := null;
  v_message text := null;
begin
  v_check := public.can_collect_card(p_review_id);

  if (v_check->>'ok')::boolean is not true then
    return json_build_object('success', false, 'message', v_check->>'message');
  end if;

  if v_check->>'reason' = 'already' then
    return json_build_object('success', true, 'cost', 0, 'already', true, 'message', 'ok');
  end if;

  v_cost      := coalesce((v_check->>'cost')::int, 0);
  v_paid_only := coalesce((v_check->>'paid_only')::boolean, false);

  -- 先に記録を作る。重複していれば v_new_id は null のままになる
  insert into public.review_card_collections (user_id, review_id, cost)
  values (v_uid, p_review_id, v_cost)
  on conflict (user_id, review_id) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    -- 二重送信。ポイントには触れていないのでそのまま成功として返す
    return json_build_object('success', true, 'cost', 0, 'already', true, 'message', 'ok');
  end if;

  if v_cost > 0 then
    if v_paid_only then
      select c.success, c.remaining, c.message
        into v_ok, v_remaining, v_message
      from public.consume_paid_points(v_cost, 'card_collect') as c;
    else
      select c.success, c.remaining, c.message
        into v_ok, v_remaining, v_message
      from public.consume_points(v_cost, 'card_collect') as c;
    end if;

    if coalesce(v_ok, false) is not true then
      -- 支払えなかったので、作ったばかりの記録を取り消す
      delete from public.review_card_collections where id = v_new_id;
      return json_build_object('success', false,
        'message', coalesce(v_message, 'ポイントの消費に失敗しました'));
    end if;
  end if;

  return json_build_object(
    'success', true,
    'cost', v_cost,
    'already', false,
    'remaining', v_remaining,
    'message', 'ok'
  );
end;
$$;

grant execute on function public.collect_review_card(uuid) to authenticated;

notify pgrst, 'reload schema';
