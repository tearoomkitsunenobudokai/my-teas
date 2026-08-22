-- 検証環境(dev)専用: 本番データ復元後に、Supabaseの標準ロールへ権限を付け直す
--
-- なぜ必要か:
--   pg_dump に --no-privileges を付けているため、GRANT の情報が dump に含まれない。
--   その結果、復元先では anon / authenticated ロールにテーブルの読み書き権限が無く、
--   RLSポリシー以前の段階で弾かれ、アプリから一切データが見えなくなる。
--   （v355で「公式の色が0件」「評価が表示されない」として発覚）
--
--   --no-privileges を外す手もあるが、その場合は本番固有の所有者情報まで持ち込むことになり
--   別のエラーを招きやすい。ここで必要な権限だけを明示的に付け直す方が安全。
--
-- 実行順: prod_dump.sql の復元 → このファイル → anonymize_dev.sql

-- スキーマそのものへのアクセス
grant usage on schema public to anon, authenticated, service_role;

-- 既存のテーブル・ビュー
grant all on all tables in schema public to anon, authenticated, service_role;

-- 連番（id採番など）
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 関数（RPCで呼ぶもの。can_collect_card など）
grant all on all functions in schema public to anon, authenticated, service_role;

-- 今後この後に作られるものにも同じ権限が付くようにしておく
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- 認証まわり（Supabase Authが参照する）
grant usage on schema auth to anon, authenticated, service_role;
