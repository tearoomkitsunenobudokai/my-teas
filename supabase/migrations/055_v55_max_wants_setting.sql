-- =============================================
-- TeaNote v55 マイグレーション（飲みたい上限の設定化）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 「飲みたい」リストの上限件数を app_settings で管理できるようにする。
-- デフォルトは10件。管理画面の「アプリ設定」タブから変更可能。

insert into public.app_settings (key, value, description)
values ('max_wants_per_user', '10', '1ユーザーが登録できる「飲みたい」の最大件数（0 = 無制限）')
on conflict (key) do nothing;
