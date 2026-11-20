// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  signOut: vi.fn(),
  signIn: {
    create: vi.fn(),
    password: vi.fn(),
    finalize: vi.fn(),
    resetPasswordEmailCode: {
      sendCode: vi.fn(),
      verifyCode: vi.fn(),
      submitPassword: vi.fn(),
    },
  },
  signUp: {
    create: vi.fn(),
    password: vi.fn(),
    verifications: {
      sendEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
    finalize: vi.fn(),
  },
}))

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans' }),
  Geist_Mono: () => ({ variable: 'geist-mono' }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: mocks.useUser,
  useClerk: () => ({
    signOut: mocks.signOut,
    client: {
      signIn: { authenticateWithRedirect: vi.fn() },
      signUp: { authenticateWithRedirect: vi.fn() },
    },
  }),
  useSignIn: () => ({ signIn: mocks.signIn }),
  useSignUp: () => ({ signUp: mocks.signUp }),
}))

vi.mock('@/components/google-analytics/GoogleAnalytics', () => ({ default: () => null }))

vi.mock('@/components/auth/auth-errors', () => ({
  getAuthErrorMessage: () => 'Authentication failed.',
  sendThemedAuthEmail: vi.fn(),
}))

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import SignInForm from '@/components/auth/SignInForm'
import SignUpForm from '@/components/auth/SignUpForm'
import GlobalNav from '@/components/GlobalNav/GlobalNav'
import { SessionExpiredModal } from '@/components/system-feedback/SystemFeedback'

const root = process.cwd()

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

function getMediaBlocks(css: string, query: string): string[] {
  const blocks: string[] = []
  let from = 0
  for (;;) {
    const start = css.indexOf(`@media ${query}`, from)
    if (start === -1) return blocks
    const open = css.indexOf('{', start)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      if (css[i] === '}') {
        depth -= 1
        if (depth === 0) { blocks.push(css.slice(open + 1, i)); from = i; break }
      }
    }
  }
}

// Body of the first rule whose selector list ends with `selector` (A2: first match wins).
function getRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

const PHONE = '(max-width: 760px)'
const TOUCH = '(max-width: 760px), (pointer: coarse)'

function signedInUser() {
  mocks.useUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'clerk_123',
      username: 'phone-user',
      fullName: 'Phone User',
      imageUrl: '',
      primaryEmailAddress: { emailAddress: 'phone@example.com' },
    },
  })
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
    notifications: { hasNotifications: false, count: 0 },
  }))
})

describe('root viewport', () => {
  it('exports a device-width, notch-aware viewport without locking zoom', async () => {
    const { viewport } = await import('@/app/layout')

    expect(viewport).toMatchObject({
      width: 'device-width',
      initialScale: 1,
      viewportFit: 'cover',
      themeColor: '#000000',
    })
    expect(viewport).not.toHaveProperty('maximumScale')
    expect(viewport).not.toHaveProperty('userScalable')
  })

  it('moves the body min-height from the 100vh utility to a dvh pair in globals', () => {
    const layout = readProjectFile('app/layout.tsx')
    const globals = readProjectFile('app/globals.css')

    expect(layout).not.toContain('min-h-screen')
    expect(getRule(globals, 'body')).toMatch(/min-height:\s*100vh;\s*min-height:\s*100dvh;/)
  })
})

describe('global mobile CSS contract', () => {
  const globals = readProjectFile('app/globals.css')

  it('defines the touch, safe-area, and gutter tokens on :root', () => {
    const rootRule = getRule(globals, ':root')

    expect(rootRule).toContain('--touch-target: 44px;')
    expect(rootRule).toContain('--safe-top: env(safe-area-inset-top, 0px);')
    expect(rootRule).toContain('--safe-right: env(safe-area-inset-right, 0px);')
    expect(rootRule).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px);')
    expect(rootRule).toContain('--safe-left: env(safe-area-inset-left, 0px);')
    expect(rootRule).toContain('--mobile-gutter: 12px;')
  })

  it('ends with the single sanctioned input font-size rule', () => {
    const d5 = [
      '@media (max-width: 760px), (pointer: coarse) {',
      '  input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),',
      '  select,',
      '  textarea {',
      '    font-size: max(16px, 1em) !important;',
      '  }',
      '}',
    ].join('\n')
    const normalized = globals.replace(/\r\n/g, '\n').trimEnd()

    expect(normalized.endsWith(d5)).toBe(true)
    expect(countMatches(globals, /!important/g)).toBe(1)
  })

  it('does not hide horizontal overflow on html or body', () => {
    expect(getRule(globals, 'html')).not.toMatch(/overflow/)
    expect(getRule(globals, 'body')).not.toMatch(/overflow/)
  })
})

describe('GlobalNav mobile CSS contract', () => {
  const css = readProjectFile('components/GlobalNav/GlobalNav.module.css')

  it('offsets the fixed avatar by the safe area and keeps z-index 340', () => {
    const navRule = getRule(css, '.nav')
    const phoneNav = getRule(getMediaBlocks(css, PHONE).join(''), '.nav')

    expect(navRule).toMatch(/z-index:\s*340/)
    expect(navRule).toContain('top: calc(6px + var(--safe-top, 0px))')
    expect(navRule).toContain('right: calc(18px + var(--safe-right, 0px))')
    expect(phoneNav).toContain('top: calc(7px + var(--safe-top, 0px))')
    expect(phoneNav).toContain('right: calc(8px + var(--safe-right, 0px))')
  })

  it('gives the trigger and menu items a 44px touch target and keeps the menu on screen', () => {
    const touch = getMediaBlocks(css, TOUCH).join('')

    expect(getRule(touch, '.avatarButton')).toContain('width: var(--touch-target, 44px)')
    expect(getRule(touch, '.avatarButton')).toContain('height: var(--touch-target, 44px)')
    expect(getRule(touch, '.menuItem')).toContain('min-height: var(--touch-target, 44px)')
    expect(getRule(css, '.menuItem')).toMatch(/min-height:\s*44px/)
    expect(getRule(css, '.menu')).toContain('max-width: calc(100vw - 16px)')
    expect(getRule(css, '.avatarFrame')).toMatch(/width:\s*40px/)
  })
})

describe('auth and system feedback mobile CSS contract', () => {
  it('fits the auth shell to phones with safe-area padding and 44px controls', () => {
    const css = readProjectFile('components/auth/auth-ui.module.css')
    const phone = getMediaBlocks(css, PHONE).join('')
    const touch = getMediaBlocks(css, TOUCH).join('')

    expect(getRule(css, '.shell')).toMatch(/min-height:\s*100vh;\s*min-height:\s*100dvh;/)
    expect(getRule(phone, '.shell')).toContain('max(16px, var(--safe-top, 0px))')
    expect(getRule(phone, '.shell')).toContain('var(--mobile-gutter, 12px)')
    expect(getRule(phone, '.header')).toContain('padding: 22px 20px 16px')
    expect(getRule(phone, '.sessionStatus')).toContain('padding: 20px 20px 24px')
    expect(getRule(touch, '.oauthButton')).toContain('min-height: var(--touch-target, 44px)')
  })

  it('keeps system feedback inside safe areas with a phone-sized session modal', () => {
    const css = readProjectFile('components/system-feedback/SystemFeedback.module.css')
    const phone = getMediaBlocks(css, PHONE).join('')
    const touch = getMediaBlocks(css, TOUCH).join('')

    expect(getRule(css, '.connectionWarning')).toContain('top: calc(14px + var(--safe-top, 0px))')
    expect(getRule(css, '.toast')).toContain('bottom: calc(24px + var(--safe-bottom, 0px))')
    expect(getRule(css, '.toastTop')).toContain('top: calc(24px + var(--safe-top, 0px))')
    expect(getRule(css, '.sessionBackdrop')).toMatch(/z-index:\s*450/)
    expect(countMatches(css, /:\s*100vh;/g)).toBe(countMatches(css, /:\s*100dvh;/g))
    expect(getRule(phone, '.sessionModal')).toContain('max-height: calc(100dvh - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 24px)')
    expect(getRule(phone, '.sessionModal')).toContain('overflow-y: auto')
    expect(getRule(phone, '.routeError')).toContain('padding: calc(56px + var(--safe-top, 0px))')
    expect(getRule(touch, '.dismissButton')).toContain('width: var(--touch-target, 44px)')
    expect(getRule(touch, '.routeError button')).toContain('min-height: var(--touch-target, 44px)')
  })

  it('keeps the landing navbar clear of the notch with a 44px menu toggle', () => {
    const navbar = readProjectFile('components/Landing/LandingNavbar.module.css')
    const page = readProjectFile('components/Landing/LandingPage.module.css')

    expect(navbar).toMatch(/\.header\s*\{[^}]*padding-top:\s*var\(--safe-top, 0px\)/)
    expect(getRule(getMediaBlocks(navbar, PHONE).join(''), '.toggle')).toMatch(/width:\s*44px/)
    expect(getRule(page, '.page')).toMatch(/min-height:\s*100vh;\s*min-height:\s*100dvh;/)
  })
})

describe('auth inputs on phones', () => {
  it('uses the right keyboards and autofill on sign-in', () => {
    render(<SignInForm />)

    const identifier = screen.getByLabelText('Email or Username')
    expect(identifier).toHaveAttribute('autocomplete', 'username')
    expect(identifier).toHaveAttribute('autocapitalize', 'none')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('uses email and new-password hints on sign-up and a numeric one-time-code field for verification', async () => {
    const user = userEvent.setup()
    mocks.signUp.create.mockResolvedValueOnce({ error: null })
    mocks.signUp.password.mockResolvedValueOnce({ error: null })
    mocks.signUp.verifications.sendEmailCode.mockResolvedValueOnce({ error: null })

    render(<SignUpForm />)

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(email).toHaveAttribute('inputmode', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')

    await user.type(email, 'player@example.com')
    await user.type(screen.getByLabelText('Username'), 'playerone')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    const code = await screen.findByLabelText('Verification Code')
    expect(code).toHaveAttribute('inputmode', 'numeric')
    expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  })

  it('uses a numeric one-time-code field and new-password on password reset', async () => {
    const user = userEvent.setup()
    mocks.signIn.create.mockResolvedValueOnce({ error: null })
    mocks.signIn.resetPasswordEmailCode.sendCode.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email or Username'), 'playerone')
    await user.click(screen.getByRole('button', { name: 'Send Reset Code' }))

    const code = await screen.findByLabelText('Reset Code')
    expect(code).toHaveAttribute('inputmode', 'numeric')
    expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    expect(screen.getByLabelText('New Password')).toHaveAttribute('autocomplete', 'new-password')
  })
})

describe('GlobalNav touch behaviour', () => {
  beforeEach(signedInUser)

  it('opens and closes the menu by tapping the avatar', async () => {
    const user = userEvent.setup()
    render(<GlobalNav />)
    const trigger = screen.getByRole('button', { name: 'Open profile navigation' })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Profile navigation' })).toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on an outside tap', async () => {
    const user = userEvent.setup()
    render(
      <>
        <GlobalNav />
        <p>Page content</p>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Open profile navigation' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.pointer({ keys: '[TouchA]', target: screen.getByText('Page content') })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps the menu open on a tap inside it, then closes after choosing an item', async () => {
    const user = userEvent.setup()
    render(<GlobalNav />)

    await user.click(screen.getByRole('button', { name: 'Open profile navigation' }))
    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('menu') })
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: /bookmarks/i }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the avatar', async () => {
    const user = userEvent.setup()
    render(<GlobalNav />)
    const trigger = screen.getByRole('button', { name: 'Open profile navigation' })

    await user.click(trigger)
    await user.tab()
    expect(screen.getByRole('menuitem', { name: /notifications/i })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SessionExpiredModal on phones', () => {
  it('portals to the body with the backdrop marker and a visible close control', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const { container } = render(
      <div style={{ transform: 'translateZ(0)' }}>
        <SessionExpiredModal open onDismiss={onDismiss} />
      </div>,
    )

    const dialog = screen.getByRole('dialog', { name: 'SESSION CONNECTION TERMINATED' })
    const backdrop = dialog.parentElement

    expect(container).not.toContainElement(dialog)
    expect(backdrop?.parentElement).toBe(document.body)
    expect(backdrop).toHaveAttribute('data-modal-backdrop', 'true')
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Close session expiry dialog' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while closed', () => {
    render(<SessionExpiredModal open={false} onDismiss={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
