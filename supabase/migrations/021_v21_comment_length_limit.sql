-- =============================================
-- TeaNote v21 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- コメント欄の文字数上限を300文字に制限
-- （既存データが300文字を超えている場合は事前に切り詰めてから実行）
update public.reviews
  set comment = left(comment, 300)
  where comment is not null and char_length(comment) > 300;

alter table public.reviews
  add constraint reviews_comment_length_check
  check (comment is null or char_length(comment) <= 300);
