-- =============================================
-- TeaNote v84 マイグレーション
--   認定店データの年度ラベルを 2025 → 2026 に修正
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 経緯: 一括登録した認定店データ（035〜047の各マイグレーション）は、
--       実際には2026年時点の掲載情報だったが、year列には誤って
--       2025 が入力されていた。データの内容（店舗名・住所・カテゴリ等）
--       は変更せず、年度ラベルのみを修正する。
--
-- 実行前に、まず対象件数を確認したい場合は以下を単独で実行してください:
--   select year, count(*) from certified_shop_years group by year order by year;

-- ① 対象範囲の確認（実行結果を確認してから、必要なら②に進んでください）
-- select count(*) as target_rows from certified_shop_years where year = 2025;

-- ② 年度ラベルを更新
--    同じ店舗が既に year=2026 のレコードを持っている場合（重複）は、
--    unique(shop_id, year) 制約に触れないよう、その分だけ古い2025行を削除する。
delete from public.certified_shop_years csy_old
where csy_old.year = 2025
  and exists (
    select 1 from public.certified_shop_years csy_new
    where csy_new.shop_id = csy_old.shop_id
      and csy_new.year = 2026
  );

update public.certified_shop_years
set year = 2026
where year = 2025;

-- ③ 確認用: 更新後の年度分布
-- select year, count(*) from certified_shop_years group by year order by year;
