-- =============================================
-- TeaNote v34 マイグレーション（スキーマキャッシュ再読み込み）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 032→033でconsume_points()の引数を変更した際、
-- PostgRESTのスキーマキャッシュが更新されず、
-- フロントからのRPC呼び出しが失敗する場合があるため、明示的にリロードする。
-- （Supabaseダッシュボード → Settings → API → 「Reload schema」ボタンでも同じ効果）

NOTIFY pgrst, 'reload schema';
