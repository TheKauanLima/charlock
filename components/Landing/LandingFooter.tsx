import Link from 'next/link'

import {
  LANDING_AI_DISCLOSURE,
  LANDING_DISCLAIMER,
  LANDING_NAV_LINKS,
  LANDING_SOCIAL_LINKS,
  LANDING_VERSION,
  LANDING_WORDMARK,
} from './landing-content'
import type { LandingSocialLink } from './landing-content'
import LandingNavLink from './LandingNavLink'

import styles from './LandingFooter.module.css'

interface LandingFooterProps {
  socialLinks?: LandingSocialLink[]
}

export default function LandingFooter({ socialLinks = LANDING_SOCIAL_LINKS }: LandingFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link className={styles.wordmark} href="/">
            {LANDING_WORDMARK}
          </Link>
          <p className={styles.disclaimer}>{LANDING_DISCLAIMER}</p>
          <div className={styles.releaseNote}>
            <p>{LANDING_AI_DISCLOSURE}</p>
            <p aria-label={`Version ${LANDING_VERSION.slice(1)}`}>{LANDING_VERSION}</p>
          </div>
        </div>

        <nav aria-label="Footer" className={styles.column}>
          <h2 className={styles.columnHeading}>Explore</h2>
          <ul className={styles.list}>
            {LANDING_NAV_LINKS.map((link) => (
              <li key={link.label}>
                <LandingNavLink className={styles.link} label={link.label} signedInHref={link.signedInHref} />
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.column}>
          <h2 className={styles.columnHeading}>Community</h2>
          <ul className={styles.list}>
            {socialLinks.map((social) => (
              <li key={social.label}>
                {social.href ? (
                  <a className={styles.link} href={social.href} target="_blank" rel="noopener noreferrer">
                    {social.label}
                  </a>
                ) : (
                  <span className={styles.disabledLink}>
                    {social.label} <span className={styles.soon}>(coming soon)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
