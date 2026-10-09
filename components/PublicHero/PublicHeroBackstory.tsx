import styles from './PublicHero.module.css'

export default function PublicHeroBackstory({ backstory }: { backstory?: string | null }) {
  const text = typeof backstory === 'string' ? backstory.trim() : ''

  if (!text) return null

  return (
    <section className={styles.panel} aria-labelledby="public-hero-backstory-heading">
      <h2 id="public-hero-backstory-heading" className={styles.sectionHeading}>Backstory</h2>
      <p className={styles.backstory}>{text}</p>
    </section>
  )
}
