-- =============================================
-- TeaNote v28 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- ① is_creator カラムを追加（製作者フラグ）
--    製作者は1名のみ想定。SQLで直接設定する。
--    製作者は管理者権限の付与/剥奪ができる唯一の存在。
alter table public.profiles
  add column if not exists is_creator boolean not null default false;

-- ② 製作者を設定する（実行前に your-user-id を実際のUUIDに書き換えてください）
-- update public.profiles set is_creator = true where id = 'your-user-id';

-- ③ is_current_user_creator() 関数を作成
create or replace function public.is_current_user_creator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_creator from public.profiles where id = auth.uid()), false)
$$;

-- ④ is_admin / is_creator の変更は製作者のみ可能にするトリガー
--    管理者が自分や他のユーザーの権限を書き換えることを防ぐ
create or replace function public.enforce_permission_change_restriction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is_admin または is_creator が変更される場合
  if (new.is_admin IS DISTINCT FROM old.is_admin) or
     (new.is_creator IS DISTINCT FROM old.is_creator) then
    -- 製作者以外はこれらのフィールドを変更できない
    if not public.is_current_user_creator() then
      raise exception '権限の変更は製作者のみ実行できます。'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_permission_restriction on public.profiles;
create trigger trg_profiles_permission_restriction
  before update on public.profiles
  for each row execute function public.enforce_permission_change_restriction();
