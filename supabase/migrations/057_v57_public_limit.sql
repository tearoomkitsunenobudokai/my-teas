-- =============================================
-- TeaNote v57 マイグレーション（公開件数の上限を追加）
-- Supabase SQL Editor で実行してください
-- =============================================
-- plan_limits に「コミュニティに公開できる評価の上限」(feature = 'public') を追加する。
-- 既存の仕組みのまま、行を追加するだけで拡張できる。
-- 初期値: 一般10 / 課金50 / 管理者・製作者 無制限(0)。管理画面で変更可。

insert into public.plan_limits (role, feature, max_count) values
  ('general',    'public', 10),
  ('subscribed', 'public', 50),
  ('admin',      'public', 0),
  ('creator',    'public', 0)
on conflict (role, feature) do nothing;
