-- =============================================
-- TeaNote v74 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- お知らせに「掲載終了日時」を追加する。
-- published_at（掲載開始日時）と合わせて、掲載期間で表示を制御できるようにする。

alter table public.announcements
  add column if not exists expires_at timestamptz;

comment on column public.announcements.expires_at is '掲載終了日時（NULL=無期限）。この日時を過ぎるとホーム画面から非表示になる。';

create index if not exists idx_announcements_expires on public.announcements(expires_at);
