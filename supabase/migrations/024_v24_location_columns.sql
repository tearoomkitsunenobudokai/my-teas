-- =============================================
-- TeaNote v24 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================
-- profiles に居住地エリア・都道府県カラムを追加する
-- 既存の location カラムは後方互換のため残しつつ、
-- location_area / location_prefecture に移行する。
-- location_visibility: 'area'=エリアまで公開 / 'prefecture'=都道府県まで公開 / 'private'=非公開

alter table public.profiles
  add column if not exists location_area       text default null,
  add column if not exists location_prefecture text default null,
  add column if not exists location_visibility text not null default 'area'
    check (location_visibility in ('area', 'prefecture', 'private'));
