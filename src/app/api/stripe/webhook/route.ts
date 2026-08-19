import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

/* 署名の検証には、加工されていない生の本文が必要になる。
   Next.js の既定の処理で本文が変換されると検証に通らなくなるため、
   このルートは動的扱いにして、req.text() で生のまま受け取る。 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stripe からの決済完了の通知を受け取り、ポイントを付与する。
 *
 * ここは「Stripeだけが呼べる場所」でなければならない。
 * 誰でも呼べると、支払わずにポイントを付け放題になってしまう。
 * そのため、本文の署名を必ず検証し、通らないものは受け付けない。
 *
 * ポイントの付与はサービスロールで行う。
 * 通知には利用者のログイン情報が付かないため、通常の権限では書き込めないため。
 */
export async function POST(req: Request) {
  const stripe = getStripe()
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripe || !whSecret || !serviceKey) {
    console.error('決済の設定が不足しています（鍵が未設定）')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'signature required' }, { status: 400 })
  }

  let event
  try {
    const raw = await req.text()
    event = stripe.webhooks.constructEvent(raw, signature, whSecret)
  } catch (e: any) {
    // 署名が合わない＝Stripe以外からの呼び出し。ここで必ず弾く
    console.error('署名の検証に失敗しました', e?.message)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // 支払いが完了したときだけ処理する
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session: any = event.data.object
  // 後払いの決済手段では、この時点でまだ入金されていないことがある
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, pending: true })
  }

  const m = session.metadata ?? {}
  const points = parseInt(m.points ?? '0', 10)
  if (!m.user_id || !points) {
    console.error('決済に必要な情報が足りません', session.id, m)
    return NextResponse.json({ error: 'missing metadata' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  /* 記録と付与はDB側でまとめて行う。
     同じ決済が二度届いても、session_id の一意制約で弾かれるので
     ポイントが重複して付くことはない。 */
  const { data, error } = await admin.rpc('record_stripe_payment', {
    p_session_id: session.id,
    p_user_id: m.user_id,
    p_package_id: m.package_id || null,
    p_package_label: m.package_label || null,
    p_points: points,
    p_amount_yen: session.amount_total ?? 0,
  })

  if (error) {
    /* ここで500を返すと、Stripeが時間を置いて再送してくれる。
       一時的な障害なら、次の再送で回復する。 */
    console.error('ポイントの付与に失敗しました', session.id, error)
    return NextResponse.json({ error: 'grant failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true, result: data })
}
