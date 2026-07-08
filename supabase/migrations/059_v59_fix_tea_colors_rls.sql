-- =============================================
-- TeaNote v59 マイグレーション（カラーパレットの公開範囲を修正）
-- Supabase SQL Editor で実行してください
-- =============================================
-- これまで tea_colors の SELECT ポリシーが using(true) だったため、
-- 他ユーザーが登録した色まで全員に見えてしまっていた。
-- 本来は「公式の色」＋「自分が登録した色」だけが見える仕様。
-- 管理者・製作者は運営のため全件閲覧可とする。

drop policy if exists "colors_select" on public.tea_colors;

create policy "colors_select" on public.tea_colors
  for select using (
    is_official = true
    or created_by = auth.uid()
    or public.is_current_user_admin()
  );
