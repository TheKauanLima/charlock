import Image from 'next/image'

import { serializeJsonLd } from '@/lib/json-ld'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site-metadata'
import { getSiteUrl } from '@/lib/site-url'

import { LANDING_BACKGROUND, LANDING_BANNER, LANDING_EXPLANATION, LANDING_TITLE } from './landing-content'
import LandingFooter from './LandingFooter'
import LandingNavbar from './LandingNavbar'

import styles from './LandingPage.module.css'

const EXPLANATION_HEADING_ID = 'landing-explanation-heading'

function buildLandingJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: SITE_NAME,
        url: `${siteUrl}/`,
        description: SITE_DESCRIPTION,
        inLanguage: 'en',
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: `${siteUrl}/`,
        logo: `${siteUrl}${LANDING_BANNER.src}`,
      },
    ],
  }
}

export default function LandingPage() {
  const jsonLd = buildLandingJsonLd(getSiteUrl())

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Decorative backdrop: lazy-loaded so the banner stays the LCP image. */}
      <div className={styles.backdrop} aria-hidden="true">
        <Image src={LANDING_BACKGROUND.src} alt="" fill sizes="100vw" className={styles.backdropImage} />
      </div>

      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <LandingNavbar />

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <section className={styles.hero}>
          <h1 className={styles.title}>{LANDING_TITLE}</h1>

          <div className={styles.bannerFrame}>
            <Image
              className={styles.banner}
              src={LANDING_BANNER.src}
              width={LANDING_BANNER.width}
              height={LANDING_BANNER.height}
              alt={LANDING_BANNER.alt}
              sizes="(max-width: 1280px) 100vw, 1280px"
              preload
            />
          </div>
        </section>

        <section className={styles.explanation} aria-labelledby={EXPLANATION_HEADING_ID}>
          <span className={styles.rule} aria-hidden="true" />
          <h2 id={EXPLANATION_HEADING_ID} className={styles.explanationHeading}>
            {LANDING_EXPLANATION.heading}
          </h2>
          <div className={styles.explanationBody}>
            {LANDING_EXPLANATION.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
