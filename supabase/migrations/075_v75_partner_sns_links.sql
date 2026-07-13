-- =============================================
-- TeaNote v75 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- SNSリンクを「アプリ公式のもの」ではなく、
-- 「My-Teasパートナー（バナー）ごとに紐づくもの」に変更する。
-- 各バナーの下に X / Instagram / その他 の3ボタンを表示するため、
-- home_links にパートナーごとのSNS URLを持たせる。

alter table public.home_links
  add column if not exists sns_x_url text,
  add column if not exists sns_instagram_url text,
  add column if not exists sns_other_url text,
  add column if not exists sns_other_label text;

comment on column public.home_links.sns_x_url is 'このパートナーのXリンク（未設定ならボタンをグレーアウト）';
comment on column public.home_links.sns_instagram_url is 'このパートナーのInstagramリンク';
comment on column public.home_links.sns_other_url is 'このパートナーのその他リンク';
comment on column public.home_links.sns_other_label is 'その他リンクの表示名（既定: その他）';

-- 旧: アプリ公式SNS用の app_settings は使わなくなるため削除
delete from public.app_settings
where key in ('sns_x_url', 'sns_instagram_url', 'sns_other_url', 'sns_other_label');
