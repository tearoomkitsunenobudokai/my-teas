-- =============================================
-- TeaNote v32b マイグレーション（032の構文エラー修正）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 032の11行目「add constraint if not exists」はPostgreSQLに存在しない構文でした。
-- （IF NOT EXISTSはADD COLUMN/DROP COLUMN/DROP CONSTRAINTでのみ使用可能）
-- 032は points カラムの追加までは成功しており、033も正常に実行済みのため、
-- 今回はこのCHECK制約1件だけを追加すれば032の内容は完了します。

-- 念のためカラム自体も存在しなければ作成（既にあれば何もしない）
alter table public.profiles
  add column if not exists points integer not null default 5;

-- CHECK制約は「存在しない場合だけ追加」をDOブロックで安全に行う
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_points_nonnegative'
  ) then
    alter table public.profiles
      add constraint profiles_points_nonnegative check (points >= 0);
  end if;
end $$;
