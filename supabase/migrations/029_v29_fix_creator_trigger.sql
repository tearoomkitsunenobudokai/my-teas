-- =============================================
-- TeaNote v29 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
-- auth.uid() が NULL の場合（SQL Editor / サービスロール / マイグレーション実行時）は
-- 権限変更トリガーをスルーするように修正する。

create or replace function public.enforce_permission_change_restriction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is_admin または is_creator が変更される場合のみチェック
  if (new.is_admin IS DISTINCT FROM old.is_admin) or
     (new.is_creator IS DISTINCT FROM old.is_creator) then

    -- auth.uid() が NULL = SQL Editor / サービスロール / マイグレーション → 許可
    if auth.uid() is null then
      return new;
    end if;

    -- アプリ経由のリクエストは製作者のみ許可
    if not public.is_current_user_creator() then
      raise exception '権限の変更は製作者のみ実行できます。'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
