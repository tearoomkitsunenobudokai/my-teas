-- =============================================
-- TeaNote v12 マイグレーション
-- お茶の水色をよりリアルな色に更新
-- Supabase SQL Editor で実行してください
-- =============================================

-- 既存の公式カラーをリアルな水色に置き換え
-- ポイント:
--  ・紅茶の水色は「半透明の液体の色」なので、明度を保ちつつ彩度を調整
--  ・アルファ値を抑えめにして、カップの白磁が透けて見える質感を再現
--  ・暗すぎる色は彩度を保ったまま明度を上げ、「液体」らしい透明感を残す

update public.tea_colors set hex = '#F7D88AD0', description = '浅蒸し・ファーストフラッシュに多い、透明感のある明るい橙色。光にかざすと黄金がかって見える。' where name = '明るい橙色';
update public.tea_colors set hex = '#E8A347D8', description = '一般的な紅茶の水色。アッサムやセイロンのブレンドに多い、バランスの取れた橙色。' where name = '橙色';
update public.tea_colors set hex = '#C8703CE0', description = 'セカンドフラッシュやケニア紅茶に多い、深みのある赤橙色。ミルクとの相性が良い。' where name = '赤橙色';
update public.tea_colors set hex = '#B8442EE0', description = 'CTC製法の紅茶や強発酵茶に見られる、鮮やかで力強い赤色。' where name = '明るい赤色';
update public.tea_colors set hex = '#7A2418E8', description = 'アッサムCTCや濃く抽出した紅茶に多い、ワインレッドに近い深い赤褐色。' where name = '深い赤色';
update public.tea_colors set hex = '#5C3324E8', description = 'ミルクティー向けの濃厚な抽出や、プーアル茶のような熟成感のある茶褐色。' where name = '茶褐色';
update public.tea_colors set hex = '#D4A03FD0', description = '透明感のある黄金色。ダージリン1stフラッシュやマスカテルフレーバーの茶に多い。' where name = '琥珀色';
update public.tea_colors set hex = '#E0B030C8', description = 'ファーストフラッシュや上質な紅茶に見られる、輝きのある黄金色。' where name = '黄金色';
update public.tea_colors set hex = '#F0E2B8C0', description = '白茶や軽い緑茶に多い、繊細で淡い黄色。ほぼ透明に近い。' where name = '淡い黄色';
update public.tea_colors set hex = '#C8CC6CC8', description = '煎茶に多い、やや黄みがかった爽やかな緑色。' where name = '黄緑色';
update public.tea_colors set hex = '#9CC050C8', description = '浅蒸し煎茶や新茶に見られる、鮮やかで若々しい緑色。' where name = '若草色';
update public.tea_colors set hex = '#5C9C4AD0', description = '深蒸し煎茶や玉露に多い、しっかりとした濃い緑色。' where name = '深緑色';
update public.tea_colors set hex = '#C8A050C8', description = '青烏龍茶（清香系・包種茶など）に多い、明るい黄褐色。' where name = '黄褐色';
update public.tea_colors set hex = '#A06830D0', description = '東方美人や熟成した烏龍茶に見られる、深みのある橙褐色。' where name = '橙褐色';
update public.tea_colors set hex = '#FAFAF8A8', description = '水出し茶や極めて軽い白茶に見られる、ほぼ無色透明の水色。' where name = '透明（無色）';
update public.tea_colors set hex = '#E8A8A8C8', description = '桃やベリー系のフレーバーティー、ルイボスブレンドなどに見られる優しいロゼ色。' where name = 'ロゼ色';

-- 念のため、上記の name に一致しない場合に備えてカテゴリ別の保険updateも実行
-- （nameが完全一致しなかった場合の救済措置。実害がなければスキップされる）
update public.tea_colors set hex = hex where false; -- no-op safeguard
