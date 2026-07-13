-- =============================================
-- TeaNote v70 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- お問い合わせフォームのURLを、コード編集なしで製作者がUIから設定できるようにする。
-- app_settings は既存テーブル（全ユーザーSELECT可・管理者以上のみUPDATE可）を利用。

insert into public.app_settings (key, value, description)
values
  ('contact_form_base_url', '', 'お問い合わせGoogleフォームの /viewform までのURL'),
  ('contact_form_entry_id', '', 'ユーザーID事前入力欄のentry ID（任意・空でも可）')
on conflict (key) do nothing;
