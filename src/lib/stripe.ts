import Stripe from 'stripe'

/**
 * Stripe に接続するための共通の入り口。
 *
 * 秘密鍵はサーバー側でしか読めない環境変数に置く。
 * NEXT_PUBLIC_ を付けるとブラウザに配られてしまうので、絶対に付けないこと。
 *
 * 鍵が未設定でもアプリ全体が起動しなくなることは避けたいので、
 * ここでは例外を投げず、使う側で null を判定して「準備中」と案内する。
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

/** 決済が使える状態か（鍵が設定されているか） */
export function isStripeReady(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET
}
