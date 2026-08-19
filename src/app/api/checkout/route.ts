import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'

/**
 * ポイント購入の決済ページを作る。
 *
 * ブラウザからは「どのプランか」だけを受け取り、
 * 金額とポイント数は必ずここでDBから読み直す。
 * ブラウザから送られた金額をそのまま使うと、書き換えて安く買われてしまうため。
 *
 * 決済手段（カード / QRコード決済 など）はコードで指定していない。
 * Stripeの管理画面で有効にしたものが自動で出るので、
 * 後から増やしても、このコードを変える必要はない。
 */
export async function POST(req: Request) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: '決済の準備が整っていません。しばらくお待ちください。' },
      { status: 503 },
    )
  }

  // ログインしている本人を、cookie から確認する
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  let packageId: string | undefined
  try {
    const body = await req.json()
    packageId = body?.packageId
  } catch {
    return NextResponse.json({ error: '入力が正しくありません' }, { status: 400 })
  }
  if (!packageId) {
    return NextResponse.json({ error: 'プランが選ばれていません' }, { status: 400 })
  }

  // 価格とポイント数はここで確定させる
  const { data: pkg, error: pkgErr } = await supabase
    .from('point_packages')
    .select('id,label,points,price_yen,is_active,is_limited,limited_until')
    .eq('id', packageId)
    .single()

  if (pkgErr || !pkg || !pkg.is_active) {
    return NextResponse.json({ error: 'このプランは現在購入できません' }, { status: 400 })
  }
  // 期間限定プランは、期限を過ぎていたら購入させない
  if (pkg.is_limited && pkg.limited_until && new Date(pkg.limited_until) < new Date()) {
    return NextResponse.json({ error: 'この期間限定プランは終了しました' }, { status: 400 })
  }
  // 0円のプランは決済を通さない（既存の無料受け取りの仕組みを使う）
  if (pkg.price_yen <= 0) {
    return NextResponse.json(
      { error: '無料プランは「受け取る」からご利用ください' },
      { status: 400 },
    )
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      /* 決済手段はここで指定しない。
         Stripeの管理画面で有効にしたものが自動的に表示されるので、
         カードやQRコード決済を後から増やしても、このコードは変えなくてよい。 */
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'jpy',
          unit_amount: pkg.price_yen,
          product_data: {
            name: `${pkg.label}（${pkg.points}pt）`,
            description: 'My-Teas ポイント',
          },
        },
      }],
      /* 付与に必要な情報を決済に紐づけておく。
         決済完了の通知にはこの中身がそのまま返ってくるので、
         誰にいくつ付けるかを通知側で作り直す必要がない。 */
      metadata: {
        user_id: user.id,
        package_id: pkg.id,
        package_label: pkg.label,
        points: String(pkg.points),
      },
      // 領収書の宛先。ユーザーが入力し直さずに済む
      customer_email: user.email ?? undefined,
      success_url: `${origin}/dashboard/points?purchase=success`,
      cancel_url: `${origin}/dashboard/points?purchase=cancel`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('決済ページの作成に失敗しました', e)
    return NextResponse.json(
      { error: '決済ページを開けませんでした。時間をおいてお試しください。' },
      { status: 500 },
    )
  }
}
