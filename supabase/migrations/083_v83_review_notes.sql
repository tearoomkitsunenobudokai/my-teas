-- =============================================
-- TeaNote v83 マイグレーション
--   評価に「その他の情報」欄（自由記述・300文字まで）を追加する
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- コメント欄とは別に、産地・グレード・購入場所・抽出条件など、
-- お茶に関する自由なメモを残せるようにする。
-- AI要約（「まとめる」ボタン）を押した際、この内容も判断材料に含める。

alter table public.reviews
  add column if not exists notes text;

alter table public.reviews
  add constraint reviews_notes_length_check check (char_length(notes) <= 300);
