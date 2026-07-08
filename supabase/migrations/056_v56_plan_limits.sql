-- =============================================
-- TeaNote v56 マイグレーション（権限区分ごとの上限管理）
-- Supabase SQL Editor で実行してください
-- =============================================
-- 一般 / 課金 / 管理者 / 製作者 の4区分ごとに、
-- 各機能（投稿数・飲みたい数…）の上限を段階的に管理する。
-- 項目を増やす場合は plan_limits に (role, feature) 行を追加するだけでよい。

-- ① 上限テーブル
create table if not exists public.plan_limits (
  role text not null check (role in ('general', 'subscribed', 'admin', 'creator')),
  feature text not null,             -- 'reviews' | 'wants' | 今後の項目
  max_count int not null default 0,  -- 0 = 無制限
  updated_at timestamptz not null default now(),
  primary key (role, feature)
);

alter table public.plan_limits enable row level security;

-- 閲覧は全ユーザー可（自分の上限を知る必要があるため）、変更は管理者のみ
create policy "plan_limits_select_all" on public.plan_limits for select using (true);
create policy "plan_limits_admin_write" on public.plan_limits
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());

-- ② 初期値（現行仕様に合わせる：投稿は既存設定、飲みたいは10、運営は無制限）
insert into public.plan_limits (role, feature, max_count) values
  ('general',    'reviews', 0),
  ('subscribed', 'reviews', 0),
  ('admin',      'reviews', 0),
  ('creator',    'reviews', 0),
  ('general',    'wants',   10),
  ('subscribed', 'wants',   30),
  ('admin',      'wants',   0),
  ('creator',    'wants',   0)
on conflict (role, feature) do nothing;

-- ③ ユーザーの区分を返す関数（優先順位: 製作者 > 管理者 > 課金 > 一般）
create or replace function public.get_user_role(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when p.is_creator then 'creator'
    when p.is_admin then 'admin'
    when p.is_subscribed then 'subscribed'
    else 'general'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

grant execute on function public.get_user_role(uuid) to anon, authenticated;

-- ④ 現在のユーザーの、指定機能の上限を返す関数（0 = 無制限）
create or replace function public.get_my_limit(p_feature text)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select l.max_count
     from public.plan_limits l
     where l.feature = p_feature
       and l.role = public.get_user_role(auth.uid())),
    0
  );
$$;

grant execute on function public.get_my_limit(text) to authenticated;
