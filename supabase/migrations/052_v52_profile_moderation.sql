-- =============================================
-- TeaNote v52 マイグレーション（プロフィールの不適切語ブロック）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 名前・自己紹介・お気に入りの紅茶に不適切な語が含まれる場合、
-- DBレベルで更新を拒否する（クライアント側チェックの改竄バイパス対策）。
--
-- ※ NGワードは src/lib/moderation.ts の NG_WORDS と内容を揃えること。
--    語を追加・変更する場合は、この関数と moderation.ts の両方を更新する。

create or replace function public.enforce_profile_text_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ng_words text[] := array[
    '死ね', '殺す', 'しね', 'ころす',
    'キチガイ', 'きちがい', 'バカ野郎', 'クズ',
    'ブス', 'デブ', 'ハゲ'
  ];
  w text;
  combined text;
begin
  -- 空白を除去して結合し、まとめて検査する
  combined := regexp_replace(
    coalesce(new.name, '') || ' ' || coalesce(new.bio, '') || ' ' || coalesce(new.favorite_tea, ''),
    '\s', '', 'g'
  );

  foreach w in array ng_words loop
    if position(w in combined) > 0 then
      raise exception 'プロフィールに不適切な表現が含まれているため保存できません。'
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_profiles_text_moderation on public.profiles;
create trigger trg_profiles_text_moderation
  before insert or update of name, bio, favorite_tea on public.profiles
  for each row execute function public.enforce_profile_text_moderation();
