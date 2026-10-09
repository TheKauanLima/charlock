export interface LandingBanner {
  src: string
  width: number
  height: number
  alt: string
}

export interface LandingBackground {
  src: string
  width: number
  height: number
}

export interface LandingExplanation {
  heading: string
  paragraphs: string[]
}

export interface LandingNavLinkConfig {
  label: string
  signedInHref: string
}

export interface LandingSocialLink {
  label: 'Discord' | 'X'
  href: string
}

export const LANDING_TITLE = 'CURSED CONCEPTS'

export const LANDING_WORDMARK = 'Cursed Concepts'

export const LANDING_BANNER: LandingBanner = {
  src: '/landing/banner.png',
  width: 1915,
  height: 649,
  alt: 'Six Deadlock hero portraits in torn-paper frames over a dark city skyline',
}

// Decorative full-page backdrop; the spire and vortex sit at about x=49%, y=10-45%.
export const LANDING_BACKGROUND: LandingBackground = {
  src: '/landing/background.png',
  width: 1920,
  height: 1080,
}

// PLACEHOLDER COPY: replace with real site explanation
export const LANDING_EXPLANATION: LandingExplanation = {
  heading: 'Placeholder: What is Cursed Concepts?',
  paragraphs: [
    'Placeholder: describe what Cursed Concepts is here.',
    'Placeholder: explain how visitors can create, share, and browse hero concepts.',
    'Placeholder: add a closing line that invites visitors to sign up.',
  ],
}

export const LANDING_NAV_LINKS: LandingNavLinkConfig[] = [
  { label: 'Browse', signedInHref: '/?tab=browse' },
  { label: 'Create', signedInHref: '/?tab=create' },
  { label: 'Hero Grid', signedInHref: '/' },
]

export const LANDING_GUEST_HREF = '/sign-up'

export const LANDING_SOCIAL_LINKS: LandingSocialLink[] = [
  // TODO: fill in real URL
  { label: 'Discord', href: '' },
  // TODO: fill in real URL
  { label: 'X', href: '' },
]

export const LANDING_DISCLAIMER = 'Unofficial fan-made site. Not affiliated with or endorsed by Valve Corporation.'

export const LANDING_AI_DISCLOSURE = 'Created with the help of AI-assisted tools.'

export const LANDING_VERSION = 'v0.9.0'
