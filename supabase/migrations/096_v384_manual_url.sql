-- =============================================
-- My-Teas v384 マイグレーション
-- ホームの「使用方法」タイルが開くマニュアルのURLを保持する。
-- Supabase SQL Editor で実行してください。
-- =============================================

-- app_settings は 020 で作成済み。ここでは初期値を入れるだけ。
-- 値が空文字のあいだは、ホームに「使用方法」タイルを出さない。
insert into public.app_settings (key, value, description)
values (
  'manual_url',
  '',
  'ホームの「使用方法」タイルが開くマニュアルのURL（空にするとタイルを表示しない）'
)
on conflict (key) do nothing;
