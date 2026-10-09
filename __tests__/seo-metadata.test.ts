import type { Metadata } from 'next'
import { describe, expect, it, vi } from 'vitest'

import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from '@/lib/site-metadata'
import { getSiteUrl } from '@/lib/site-url'

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}))
vi.mock('@clerk/nextjs', () => ({ ClerkProvider: () => null }))
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/components/google-analytics/GoogleAnalytics', () => ({ default: () => null }))
vi.mock('@/components/GlobalNav/GlobalNav', () => ({ default: () => null }))
vi.mock('@/components/auth/AuthenticatedHome', () => ({ default: () => null }))
vi.mock('@/components/HeroGrid/HeroGrid', () => ({ default: () => null }))
vi.mock('@/components/Landing/LandingPage', () => ({ default: () => null }))
vi.mock('@/components/auth/AuthShell', () => ({ default: () => null, AuthLink: () => null }))
vi.mock('@/components/auth/GuestOnlyAuth', () => ({ default: () => null }))
vi.mock('@/components/auth/SignInForm', () => ({ default: () => null }))
vi.mock('@/components/auth/SignUpForm', () => ({ default: () => null }))
vi.mock('@/components/auth/ForgotPasswordForm', () => ({ default: () => null }))
vi.mock('@/components/Moderation/AdminModerationDashboard', () => ({ default: () => null }))
vi.mock('@/components/UserProfile/ProfileUnavailable', () => ({ default: () => null }))
vi.mock('@/components/UserProfile/ProfileSettings', () => ({ default: () => null }))
vi.mock('@/lib/admin-guard', () => ({ checkAdmin: vi.fn() }))
vi.mock('@/lib/moderation', () => ({ listModerationQueue: vi.fn() }))
vi.mock('@/lib/profile', () => ({
  getCurrentProfileUser: vi.fn(),
  getProfilePathSegment: vi.fn(),
  getUserProfile: vi.fn(),
  isProfileUnavailableError: vi.fn(),
}))

const NOINDEX = { index: false, follow: false }

async function loadPageMetadata(): Promise<Record<string, Metadata>> {
  return {
    home: (await import('@/app/page')).metadata,
    signIn: (await import('@/app/(auth)/sign-in/page')).metadata,
    signUp: (await import('@/app/(auth)/sign-up/page')).metadata,
    forgotPassword: (await import('@/app/(auth)/forgot-password/page')).metadata,
    admin: (await import('@/app/admin/page')).metadata,
    profileSettings: (await import('@/app/profile/settings/page')).metadata,
    ssoCallbackLayout: (await import('@/app/sso-callback/layout')).metadata,
  }
}

describe('root metadata', () => {
  it('sets site-wide defaults', async () => {
    const { metadata } = await import('@/app/layout')

    expect(metadata.metadataBase).toBeInstanceOf(URL)
    expect(String(metadata.metadataBase)).toBe(`${getSiteUrl()}/`)
    expect(metadata.title).toEqual({ default: SITE_NAME, template: `%s | ${SITE_NAME}` })
    expect(metadata.description).toBe(SITE_DESCRIPTION)
    expect(metadata.applicationName).toBe(SITE_NAME)
    expect(metadata.keywords).toEqual(SITE_KEYWORDS)
  })

  it('sets openGraph and twitter defaults without url, images, title, or description', async () => {
    const { metadata } = await import('@/app/layout')

    // Option (a): Next fills og/twitter title and description from each page's metadata.
    expect(metadata.openGraph).toEqual({ type: 'website', siteName: SITE_NAME, locale: 'en_US' })
    expect(metadata.twitter).toEqual({ card: 'summary_large_image' })
  })

  it('no longer uses the old Charlock Hero Grid title', async () => {
    const { metadata } = await import('@/app/layout')

    expect(JSON.stringify(metadata)).not.toContain('Charlock Hero Grid')
  })
})

describe('page metadata', () => {
  it('gives / an absolute title, the shared description, and a canonical', async () => {
    const { home } = await loadPageMetadata()

    expect(home.title).toEqual({ absolute: SITE_NAME })
    expect(home.description).toBe(SITE_DESCRIPTION)
    expect(home.alternates).toEqual({ canonical: '/' })
    expect(home.robots).toBeUndefined()
  })

  it.each([
    ['signIn', 'Sign in'],
    ['signUp', 'Sign up'],
    ['forgotPassword', 'Reset password'],
    ['admin', 'Admin'],
    ['profileSettings', 'Profile settings'],
    ['ssoCallbackLayout', 'Signing in'],
  ])('marks %s as noindex with title %j', async (key, title) => {
    const pages = await loadPageMetadata()

    expect(pages[key].title).toBe(title)
    expect(pages[key].robots).toEqual(NOINDEX)
  })

  it('never sets openGraph or twitter on pages or nested layouts', async () => {
    const pages = await loadPageMetadata()

    for (const metadata of Object.values(pages)) {
      expect(metadata).not.toHaveProperty('openGraph')
      expect(metadata).not.toHaveProperty('twitter')
    }
  })

  it('renders the sso-callback layout children unchanged', async () => {
    const { default: SsoCallbackLayout } = await import('@/app/sso-callback/layout')

    expect(SsoCallbackLayout({ children: 'child' })).toBe('child')
  })
})
