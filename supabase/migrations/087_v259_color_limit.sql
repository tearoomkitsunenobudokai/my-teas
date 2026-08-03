-- ============================================================
-- 087: カラーパレットの登録上限を plan_limits で管理する
--
-- これまでカラーパレットの上限だけが plan_limits の仕組みに乗っておらず、
-- アプリ側に 16 が直書きされていたため、管理者メニューから変更できなかった。
-- 他の機能（reviews / public / wants）と同じく権限区分ごとに設定できるようにする。
--
-- ※ max_count = 0 は「無制限」の意味（既存の get_my_limit の仕様に合わせる）
-- ============================================================

insert into public.plan_limits (role, feature, max_count) values
  ('general',    'colors', 16),   -- 従来のコード上の上限を初期値とする
  ('subscribed', 'colors', 32),   -- 課金者は多めに
  ('admin',      'colors', 0),    -- 管理者・製作者は無制限
  ('creator',    'colors', 0)
on conflict (role, feature) do nothing;
