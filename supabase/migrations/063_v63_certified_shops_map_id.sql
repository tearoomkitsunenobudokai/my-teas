-- =============================================
-- TeaNote v63 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 認定店タブの「Googleマイマップ」IDを app_settings に登録
-- 目的: これまで localStorage（端末ローカル）に保存していたため
--       製作者が設定しても他ユーザー・他端末には反映されなかった。
--       app_settings（全ユーザーSELECT可・管理者以上のみUPDATE可のRLS済み）
--       に保存することで、全ユーザー共通のマップ表示に切り替える。
insert into public.app_settings (key, value, description)
values (
  'certified_shops_map_id',
  '',
  '認定店タブに表示するGoogleマイマップのID（全ユーザー共通）'
)
on conflict (key) do nothing;
