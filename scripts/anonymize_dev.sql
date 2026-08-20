-- 検証環境(dev)専用: 本番データ複製後に実行する匿名化スクリプト
-- 本番(prod)には絶対に実行しないこと。

-- auth.usersのメールアドレスをダミー値に置き換える
update auth.users
set email = 'user-' || id || '@example.invalid',
    raw_user_meta_data = raw_user_meta_data - 'full_name' - 'name',
    phone = null
where email is not null;

-- profiles.name(表示名)をダミー値に置き換える
update public.profiles
set name = 'ユーザー' || substring(id::text, 1, 8);

-- avatar_urlは実ファイルを複製していないため空にしておく(壊れた画像表示を防ぐ)
update public.profiles
set avatar_url = null
where avatar_url is not null;
