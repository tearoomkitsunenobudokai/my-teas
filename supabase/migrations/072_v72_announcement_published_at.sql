-- =============================================
-- TeaNote v72 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- お知らせに「掲載日時」を明示的に指定できるようにする。
-- 未来の日時を設定すると、その日時になるまでホーム画面に表示されない
-- （予約投稿として機能する）。

alter table public.announcements
  add column if not exists published_at timestamptz not null default now();

comment on column public.announcements.published_at is '掲載日時。未来日時なら予約投稿として扱う。';

create index if not exists idx_announcements_published on public.announcements(published_at);
