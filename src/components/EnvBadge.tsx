import { IS_PREVIEW, SUPABASE_HOST } from '@/lib/version'

/*
 * 検証環境（Vercelのプレビュー）でのみ、画面の隅に小さな帯を出す。
 *
 * 本番（my-teas.jp）では何も表示されない。
 * 「今見ている画面がどちらのDBを触っているか」を取り違えると、
 * 本番データを検証のつもりで消してしまう事故につながるため。
 *
 * 判定には Vercel が自動で入れる NEXT_PUBLIC_VERCEL_ENV を使う。
 * production / preview / development のいずれかが入る。
 */
export default function EnvBadge() {
  if (!IS_PREVIEW) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 9999,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(180, 83, 9, 0.92)',
        color: '#fff',
        fontSize: 11,
        lineHeight: 1.4,
        fontWeight: 700,
        letterSpacing: '0.02em',
        pointerEvents: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}
    >
      検証環境{SUPABASE_HOST ? `（${SUPABASE_HOST}）` : ''}
    </div>
  )
}
