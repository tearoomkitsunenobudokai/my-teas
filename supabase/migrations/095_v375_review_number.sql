-- =============================================
-- My-Teas v375 マイグレーション
-- 評価に管理番号（連番）を追加する
-- Supabase SQL Editor で実行してください
-- =============================================
--
-- 目的:
--   カードに印字した番号から、サイトで元の評価を特定できるようにする。
--
-- なぜ連番にしたか:
--   reviews.id は UUID（36桁）で、印刷したカードから手入力するには長すぎる。
--   UUIDの一部を切り出す案もあったが、理論上は重複し得る。
--   カードは印刷して人に見せるものなので、確実に一意で、かつ読み上げ・
--   手入力しやすい形にした。
--
-- 番号の形式:
--   8桁ゼロ埋めの整数。画面表示では接頭辞を付ける。
--     MY-00000010  自分が記録した評価
--     CO-00000010  他の人の評価を集めたもの（同じ評価なので数字は同じ）
--   接頭辞は表示だけの区別で、DBには数字しか持たない。
--   8桁で約1億件まで扱える。列は bigint なので、桁が足りなくなったら
--   表示側を広げるだけでよい（検索は数字だけを見るため古いカードも引ける）。

-- ── 1. 連番を発行するシーケンス ──
create sequence if not exists public.review_number_seq
  start with 1
  increment by 1
  no cycle;

-- ── 2. 列を追加 ──
-- 既存行にも値が必要なので、まず null 許容で追加する。
alter table public.reviews
  add column if not exists review_no bigint;

-- ── 3. 既存の評価に番号を振る ──
-- 古い順に採番する（記録した順に番号が並ぶほうが自然なため）。
do $$
declare
  r record;
begin
  for r in
    select id from public.reviews
    where review_no is null
    order by created_at asc, id asc
  loop
    update public.reviews
      set review_no = nextval('public.review_number_seq')
      where id = r.id;
  end loop;
end $$;

-- ── 4. 以降の新規行に自動で採番する ──
alter table public.reviews
  alter column review_no set default nextval('public.review_number_seq');

-- 既存行を埋め終えたので、これ以降は必須にする
alter table public.reviews
  alter column review_no set not null;

-- ── 5. 一意制約と検索用の索引 ──
-- 番号から評価を引く用途なので、一意かつ索引が必要。
create unique index if not exists reviews_review_no_key
  on public.reviews (review_no);

-- ── 6. 集めたカードのビューを作り直す ──
-- ★ create or replace view では列を追加できない（v336で発生した問題）。
--   末尾に足す場合も、安全のため drop してから作り直す。
--   ビューは実データを持たないため、削除しても記録は失われない。
drop view if exists public.my_collected_cards;

create view public.my_collected_cards
with (security_invoker = true)
as
select
  c.id            as collection_id,
  c.collected_at,
  c.cost,
  r.id            as review_id,
  r.review_no,
  r.tea_name, r.brand_name, r.shop_name, r.tea_garden, r.origin_country,
  r.color_hex, r.color_name, r.aroma_notes, r.comment, r.drank_at,
  r.brew_method, r.steep_seconds, r.tea_grams_per_100ml, r.tea_grams, r.water_ml,
  r.accompaniments,
  r.score_aroma, r.score_astringency, r.score_richness, r.score_color_depth,
  r.user_id       as author_id,
  p.name          as author_name
from public.review_card_collections c
join public.reviews r on r.id = c.review_id
left join public.public_profiles p on p.id = r.user_id
where c.user_id = auth.uid();

grant select on public.my_collected_cards to authenticated;

notify pgrst, 'reload schema';
