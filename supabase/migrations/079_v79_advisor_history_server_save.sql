-- =============================================
-- TeaNote v79 マイグレーション（AIアドバイザー履歴のサーバー保存）
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- これまで、AIアドバイザーの分析履歴はブラウザのlocalStorage（端末内）にのみ保存していた。
-- ポイントを消費して得た結果であるため、機種変更・キャッシュ削除で失われるのは損失が大きい。
-- サーバー（DB）保存に切り替え、どの端末からでも同じ履歴を参照できるようにする。
--
-- 保存期間は、これまでの「7日」から「30日」に延長する（有償の結果を残す期間として）。
-- 期間は app_settings で変更できる。

-- ① 分析履歴テーブル
create table if not exists public.advisor_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_key text not null,            -- その時選ばれていたキャラクター
  comment text not null,             -- 生成されたコメント
  created_at timestamptz not null default now()
);

alter table public.advisor_history enable row level security;

drop policy if exists "advisor_history_select_own" on public.advisor_history;
create policy "advisor_history_select_own" on public.advisor_history
  for select using (auth.uid() = user_id);

drop policy if exists "advisor_history_insert_own" on public.advisor_history;
create policy "advisor_history_insert_own" on public.advisor_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "advisor_history_delete_own" on public.advisor_history;
create policy "advisor_history_delete_own" on public.advisor_history
  for delete using (auth.uid() = user_id);

create index if not exists idx_advisor_history_user_created
  on public.advisor_history (user_id, created_at desc);

-- ② 保存期間の設定値（日数）
insert into public.app_settings (key, value, description) values
  ('advisor_history_days', '30', 'AIアドバイザーの分析履歴を保持する日数')
on conflict (key) do nothing;

-- ③ 履歴を1件追加し、同時に期限切れの古い履歴を掃除する関数
create or replace function public.add_advisor_history(p_tier_key text, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
begin
  if auth.uid() is null then return; end if;

  insert into public.advisor_history (user_id, tier_key, comment)
  values (auth.uid(), p_tier_key, p_comment);

  -- 保存期間を過ぎた自分の履歴を削除（都度掃除するのでcron不要）
  v_days := public.get_setting_int('advisor_history_days', 30);
  delete from public.advisor_history
  where user_id = auth.uid()
    and created_at < now() - make_interval(days => v_days);
end;
$$;

grant execute on function public.add_advisor_history(text, text) to authenticated;

-- ④ 端末に残っている既存履歴をサーバーへ引き継ぐための関数
--    アプリ側が localStorage の履歴（JSON配列）を渡すと、保存期間内のものだけ取り込む。
--    同一内容の二重取り込みを避けるため、同じ tier_key・comment・作成時刻のものは追加しない。
create or replace function public.merge_advisor_history(p_entries jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_added int := 0;
  v_rec record;
  v_created timestamptz;
begin
  if auth.uid() is null or p_entries is null then return 0; end if;
  v_days := public.get_setting_int('advisor_history_days', 30);

  for v_rec in select * from jsonb_array_elements(p_entries) as e(item)
  loop
    v_created := (v_rec.item ->> 'createdAt')::timestamptz;
    -- 保存期間外のものは取り込まない
    if v_created is null or v_created < now() - make_interval(days => v_days) then
      continue;
    end if;
    -- 既に同じ内容が入っていればスキップ
    if exists (
      select 1 from public.advisor_history
      where user_id = auth.uid()
        and tier_key = (v_rec.item ->> 'tierKey')
        and comment  = (v_rec.item ->> 'comment')
        and created_at = v_created
    ) then
      continue;
    end if;

    insert into public.advisor_history (user_id, tier_key, comment, created_at)
    values (auth.uid(), v_rec.item ->> 'tierKey', v_rec.item ->> 'comment', v_created);
    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;

grant execute on function public.merge_advisor_history(jsonb) to authenticated;
