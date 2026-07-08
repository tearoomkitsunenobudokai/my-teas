-- =============================================
-- ロンドンティールーム 北堀江店の座標を手動修正
-- Supabase SQL Editor で実行してください
-- =============================================

-- Google Maps で確認した正確な座標を設定
UPDATE public.certified_shops
SET
  lat = 34.6814,
  lng = 135.4965
WHERE
  name LIKE '%ロンドンティールーム%北堀江%'
  OR (name LIKE '%ロンドンティールーム%' AND prefecture = '大阪');

-- 確認
SELECT id, name, address, lat, lng FROM public.certified_shops
WHERE name LIKE '%ロンドン%';
