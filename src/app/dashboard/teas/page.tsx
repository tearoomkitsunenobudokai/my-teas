import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Tea, CATEGORY_LABELS } from '@/types'
import Link from 'next/link'
import AddTeaButton from './AddTeaButton'
import styles from './teas.module.css'

const CAT_COLORS: Record<string, string> = {
  black: '#D3D1C7', green: '#C0DD97', oolong: '#FAC775', white: '#B5D4F4', herbal: '#9FE1CB'
}

export default async function TeasPage() {
  const supabase = createServerSupabaseClient()
  const { data: teas } = await supabase.from('teas').select('*, profiles(name)').order('is_official', { ascending: false }).order('created_at')

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>お茶一覧</h1>
        <AddTeaButton />
      </div>
      <div className={styles.grid}>
        {teas?.map((tea: Tea) => (
          <Link href={`/dashboard/teas/${tea.id}`} key={tea.id} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.badge} style={{ background: CAT_COLORS[tea.category] ?? '#eee' }}>
                {CATEGORY_LABELS[tea.category]}
              </span>
              {tea.is_official && <span className={styles.official}>公式</span>}
            </div>
            <div className={styles.name}>{tea.name}</div>
            <div className={styles.origin}>{tea.origin}</div>
            {tea.description && <p className={styles.desc}>{tea.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
