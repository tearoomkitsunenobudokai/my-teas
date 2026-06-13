'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function DeleteTeaButton({ teaId }: { teaId: string }) {
  const router = useRouter()
  const supabase = createClient()
  async function del() {
    if (!confirm('この茶葉を削除しますか？関連する評価も削除されます。')) return
    await supabase.from('teas').delete().eq('id', teaId)
    router.refresh()
  }
  return <button onClick={del} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'13px' }}>削除</button>
}
