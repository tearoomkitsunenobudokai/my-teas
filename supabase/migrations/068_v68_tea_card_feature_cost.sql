-- =============================================
-- TeaNote v68 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 評価カード画像の生成機能（1ポイント消費）を feature_costs に追加。
-- 既存のAIアドバイザー等と同じく、管理画面「💎 ポイント設定」タブから
-- 消費ポイント数を変更できるようになる。

insert into public.feature_costs (feature, cost, label, sort_order) values
  ('tea_card', 1, '評価カード画像の作成', 5)
on conflict (feature) do nothing;
