-- =============================================
-- TeaNote v18 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- reviews テーブルから水色・香り分析カラムを削除
-- （これらは teas / tea_aroma_data テーブルで管理）
alter table public.reviews
  drop column if exists color_hex,
  drop column if exists aroma_notes,
  drop column if exists aroma_description;
