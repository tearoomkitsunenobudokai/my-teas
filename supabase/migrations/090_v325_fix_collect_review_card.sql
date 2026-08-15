-- =============================================
-- My-Teas v325 マイグレーション
-- collect_review_card の不具合修正
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 修正1: record "v_res" is not assigned yet
--   料金が0ptのときはポイント消費の処理を通らないため、v_res が未代入のまま
--   最後の returning で参照されエラーになっていた。
--   残ポイントは代入された場合だけ返すようにする。
--
-- 修正2: 二重送信時の返却で、無料ポイントが購入ポイントに化ける可能性があった
--   以前は重複を検知したあとに grant_paid_points で返却していたが、
--   無料ポイントで支払った場合でも購入ポイントとして戻ってしまう。
--   意図的に二重送信を繰り返せば、無料ポイントを購入ポイントに変換できてしまう。
--   そこで「先に記録を作り、後からポイントを消費する」順序に変える。
--   重複はこの時点で分かるのでポイントに触れる必要がなくなり、
--   消費に失敗した場合は作った記録を消せば元の状態に戻せる。

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
  v_new_id uuid;
  v_remaining int;
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

  /* 先に記録を作る。
     すでに同じ組み合わせがあれば何も起きず v_new_id は null になるので、
     ポイントを消費する前に重複だと分かる。 */
  insert into public.review_card_collections (user_id, review_id, cost)
  values (v_uid, p_review_id, v_cost)
  on conflict (user_id, review_id) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    -- 二重送信。ポイントには一切触れていないので、そのまま成功として返す
    return json_build_object('success', true, 'cost', 0, 'already', true, 'message', 'ok');
  end if;

  if v_cost > 0 then
    if v_paid_only then
      select * into v_res from public.consume_paid_points(v_cost, 'card_collect');
    else
      select * into v_res from public.consume_points(v_cost, 'card_collect');
    end if;

    if v_res.success is not true then
      -- 支払えなかったので、作ったばかりの記録を取り消す
      delete from public.review_card_collections where id = v_new_id;
      return json_build_object('success', false, 'message', v_res.message);
    end if;

    v_remaining := v_res.remaining;
  end if;

  return json_build_object(
    'success', true,
    'cost', v_cost,
    'already', false,
    -- 消費が発生しなかった場合は null のまま返す
    'remaining', v_remaining,
    'message', 'ok'
  );
end;
$$;

grant execute on function public.collect_review_card(uuid) to authenticated;

notify pgrst, 'reload schema';
