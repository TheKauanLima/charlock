import type { PublicHeroVisibility } from '@/lib/public-page-types'

import styles from './PublicHero.module.css'

const BANNER_TEXT: Record<Exclude<PublicHeroVisibility, 'public'>, string> = {
  'owner-private': 'Private, only visible to you',
  'owner-hidden': 'Hidden by moderation',
}

export default function PublicHeroVisibilityBanner({ visibility }: { visibility: PublicHeroVisibility }) {
  if (visibility === 'public') return null

  return (
    <p className={styles.visibilityBanner} data-visibility={visibility}>
      {BANNER_TEXT[visibility]}
    </p>
  )
}
