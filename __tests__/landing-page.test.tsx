// @vitest-environment jsdom

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => clerkState,
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; preload?: boolean }) => {
    const { fill, priority, preload, ...imageProps } = props
    return React.createElement('img', {
      ...imageProps,
      'data-fill': fill ? 'true' : undefined,
      'data-preload': preload || priority ? 'true' : undefined,
    })
  },
}))

import LandingFooter from '@/components/Landing/LandingFooter'
import LandingPage from '@/components/Landing/LandingPage'
import {
  LANDING_AI_DISCLOSURE,
  LANDING_BANNER,
  LANDING_DISCLAIMER,
  LANDING_EXPLANATION,
  LANDING_TITLE,
  LANDING_VERSION,
  LANDING_WORDMARK,
} from '@/components/Landing/landing-content'

const NAV_LABELS = ['Browse', 'Create', 'Hero Grid']

function getMainNav() {
  return screen.getByRole('navigation', { name: 'Main' })
}

function getFooterNav() {
  return screen.getByRole('navigation', { name: 'Footer' })
}

beforeEach(() => {
  clerkState.isLoaded = true
  clerkState.isSignedIn = false
})

describe('LandingPage', () => {
  it('renders a single centered title heading', () => {
    render(<LandingPage />)

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(LANDING_TITLE)
    expect(LANDING_TITLE).toBe('CURSED CONCEPTS')
  })

  it('renders the banner image below the title', () => {
    render(<LandingPage />)

    const banner = screen.getByRole('img', { name: LANDING_BANNER.alt })
    expect(banner.getAttribute('src')).toContain('banner.png')
  })

  it('renders a decorative, lazily loaded full-page background image', () => {
    const { container } = render(<LandingPage />)

    const background = container.querySelector('img[src*="background.png"]')
    expect(background).toBeInTheDocument()
    expect(background).toHaveAttribute('alt', '')
    expect(background).toHaveAttribute('data-fill', 'true')
    expect(background).not.toHaveAttribute('data-preload')
    expect(background?.parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('preloads only the banner image', () => {
    const { container } = render(<LandingPage />)

    const banner = screen.getByRole('img', { name: LANDING_BANNER.alt })
    expect(banner).toHaveAttribute('data-preload', 'true')
    const preloaded = container.querySelectorAll('img[data-preload="true"]')
    expect(preloaded).toHaveLength(1)
    expect(preloaded[0]).toBe(banner)
  })

  it('renders the wordmark as a home link in the navbar and footer', () => {
    render(<LandingPage />)

    expect(within(getMainNav()).getByRole('link', { name: LANDING_WORDMARK })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: LANDING_WORDMARK })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('sends signed-out visitors from every nav link to account creation', () => {
    render(<LandingPage />)

    for (const nav of [getMainNav(), getFooterNav()]) {
      for (const label of NAV_LABELS) {
        expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', '/sign-up')
      }
    }

    expect(within(getMainNav()).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(within(getMainNav()).getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up')
  })

  it('treats a not-yet-loaded Clerk session as signed out', () => {
    clerkState.isLoaded = false

    render(<LandingPage />)

    expect(within(getMainNav()).getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/sign-up')
    expect(within(getMainNav()).getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('routes signed-in users to app destinations and hides auth buttons', () => {
    clerkState.isSignedIn = true

    render(<LandingPage />)

    const expected: Record<string, string> = {
      Browse: '/?tab=browse',
      Create: '/?tab=create',
      'Hero Grid': '/',
    }

    for (const nav of [getMainNav(), getFooterNav()]) {
      for (const [label, href] of Object.entries(expected)) {
        expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href)
      }
    }

    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument()
  })

  it('toggles the mobile menu and closes it on Escape', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const panelId = toggle.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    expect(document.getElementById(panelId as string)).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Close menu')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the mobile menu when a link is clicked', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    const toggle = screen.getByRole('button', { name: 'Open menu' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const preventNavigation = (event: MouseEvent) => event.preventDefault()
    document.addEventListener('click', preventNavigation)
    fireEvent.click(within(getMainNav()).getByRole('link', { name: 'Browse' }))
    document.removeEventListener('click', preventNavigation)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('provides a skip link to the main content', () => {
    const { container } = render(<LandingPage />)

    const skipLink = screen.getByRole('link', { name: 'Skip to content' })
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(container.querySelector('main#main-content')).toBeInTheDocument()
  })

  it('renders the explanation section from the content config', () => {
    render(<LandingPage />)

    const section = screen.getByRole('region', { name: LANDING_EXPLANATION.heading })
    expect(within(section).getByRole('heading', { level: 2, name: LANDING_EXPLANATION.heading })).toBeInTheDocument()
    for (const paragraph of LANDING_EXPLANATION.paragraphs) {
      expect(within(section).getByText(paragraph)).toBeInTheDocument()
    }
  })

  it('renders the footer disclosures, version, and placeholder socials without anchors', () => {
    render(<LandingPage />)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText(LANDING_DISCLAIMER)).toBeInTheDocument()
    expect(within(footer).getByText(LANDING_AI_DISCLOSURE)).toBeInTheDocument()
    expect(within(footer).getByLabelText('Version 0.9.0')).toHaveTextContent(LANDING_VERSION)
    const discord = within(footer).getByText(/Discord/)
    expect(discord).toBeInTheDocument()
    expect(discord).not.toHaveAttribute('aria-disabled')
    expect(within(discord).getByText('(coming soon)')).toBeInTheDocument()
    expect(footer.querySelector('[aria-disabled]')).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: /Discord/ })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: /^X/ })).not.toBeInTheDocument()
  })

  it('renders filled social links as external anchors', () => {
    render(
      <LandingFooter
        socialLinks={[
          { label: 'Discord', href: 'https://discord.gg/example' },
          { label: 'X', href: '' },
        ]}
      />,
    )

    const discord = screen.getByRole('link', { name: 'Discord' })
    expect(discord).toHaveAttribute('href', 'https://discord.gg/example')
    expect(discord).toHaveAttribute('target', '_blank')
    expect(discord).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: /^X/ })).not.toBeInTheDocument()
  })

  it('renders one escaped JSON-LD script with WebSite and Organization entries', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    try {
      const { container } = render(<LandingPage />)

      const scripts = container.querySelectorAll('script[type="application/ld+json"]')
      expect(scripts).toHaveLength(1)
      expect(container.firstElementChild?.firstElementChild).toBe(scripts[0])

      const raw = scripts[0].textContent ?? ''
      expect(raw).not.toContain('<')

      const data = JSON.parse(raw) as { '@context': string; '@graph': Array<Record<string, unknown>> }
      expect(data['@context']).toBe('https://schema.org')

      const website = data['@graph'].find((node) => node['@type'] === 'WebSite')
      expect(website).toBeDefined()
      expect(website?.url).toBe('https://cursedconcepts.xyz/')
      expect(String(website?.url).endsWith('/')).toBe(true)

      const organization = data['@graph'].find((node) => node['@type'] === 'Organization')
      expect(organization).toBeDefined()
      expect(organization).not.toHaveProperty('sameAs')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not link to privacy or terms pages', () => {
    render(<LandingPage />)

    expect(screen.queryByText(/Privacy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Terms/i)).not.toBeInTheDocument()
  })
})
