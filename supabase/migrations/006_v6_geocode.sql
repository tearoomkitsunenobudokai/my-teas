-- =============================================
-- TeaNote v6 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- certified_shops に緯度・経度を追加
-- （住所からジオコーディングした結果を保存する）
alter table public.certified_shops
  add column if not exists lat numeric,
  add column if not exists lng numeric;
