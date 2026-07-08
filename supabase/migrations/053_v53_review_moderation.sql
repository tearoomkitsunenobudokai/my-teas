-- =============================================
-- TeaNote v53 マイグレーション（評価コメントのモデレーション）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 評価コメントに不適切な語が含まれる場合、
-- is_public を強制的に false にする（コミュニティに公開させない）。
-- 保存自体は許可する（本人の記録としては残る）点がプロフィール検査との違い。
--
-- クライアント側チェック（src/lib/moderation.ts）の改竄バイパス対策として、
-- DB側でも同じNGワードを検査する二重防御。
-- ※ NGワードは moderation.ts / 052 のトリガーと内容を揃えること。

create or replace function public.enforce_review_comment_moderation()
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
  normalized text;
begin
  -- 公開しようとしていて、かつコメントがある場合のみ検査
  if new.is_public is true and new.comment is not null then
    normalized := regexp_replace(new.comment, '\s', '', 'g');
    foreach w in array ng_words loop
      if position(w in normalized) > 0 then
        -- 公開を強制的に取り下げる（保存は通す）
        new.is_public := false;
        exit;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reviews_comment_moderation on public.reviews;
create trigger trg_reviews_comment_moderation
  before insert or update on public.reviews
  for each row execute function public.enforce_review_comment_moderation();
