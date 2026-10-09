import Link from 'next/link'

import styles from '@/components/PublicHero/PublicHero.module.css'

export default function HeroNotFound() {
  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <section className={`${styles.panel} ${styles.notFound}`}>
          <h1>Hero not found</h1>
          <p>This hero concept does not exist or is not public.</p>
          <Link href="/?tab=browse" className={styles.actionButton}>
            Browse heroes
          </Link>
        </section>
      </div>
    </main>
  )
}
