// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import PublicHeroCommentForm from '@/components/PublicHero/PublicHeroCommentForm'
import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import { ProfileSettingsPanel } from '@/components/UserProfile/ProfileSettings'
import UserProfile from '@/components/UserProfile/UserProfile'
import { HEROES } from '@/lib/hero-data'
import type { UserProfileData } from '@/lib/profile'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.priority
    delete (imageProps as Record<string, unknown>).preload
    delete (imageProps as Record<string, unknown>).blurDataURL
    delete (imageProps as Record<string, unknown>).placeholder

    return React.createElement('img', imageProps)
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/app/profile/actions', () => ({
  deleteAccount: vi.fn(async () => undefined),
  updateProfileBackground: vi.fn(async (backgroundId: string) => ({ success: true, backgroundId })),
  updateProfileSettings: vi.fn(async () => undefined),
  updateUsername: vi.fn(async () => undefined),
}))

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ openUserProfile: vi.fn() }),
}))

// ---------------------------------------------------------------------------
// CSS helpers (copied per spec 23 section 6; do not share between test files)
// ---------------------------------------------------------------------------

function readCss(path: string) {
  return readFileSync(path, 'utf8')
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Body of the first rule whose selector list contains `selector`. */
function getRule(css: string, selector: string) {
  const pattern = new RegExp(`(?:^|[\\s,}])${escapeRegExp(selector)}(?![\\w-])[^{}]*\\{([^}]*)\\}`)

  return css.match(pattern)?.[1] ?? ''
}

const PHONE = '(max-width: 760px)'
const TOUCH = '(max-width: 760px), (pointer: coarse)'
const TOUCH_MIN_HEIGHT = /min-height:\s*var\(--touch-target, 44px\)/
const SAFE_TOP_56 = /calc\(56px \+ var\(--safe-top, 0px\)\)/

const USER_PROFILE_CSS = 'components/UserProfile/UserProfile.module.css'
const PROFILE_SETTINGS_CSS = 'components/UserProfile/ProfileSettings.module.css'
const PUBLIC_PROFILE_CSS = 'components/UserProfile/PublicUserProfile.module.css'
const PUBLIC_HERO_CSS = 'components/PublicHero/PublicHero.module.css'
const ADMIN_CSS = 'components/Moderation/AdminModerationDashboard.module.css'
const STEP_SIX_CSS = [USER_PROFILE_CSS, PROFILE_SETTINGS_CSS, PUBLIC_PROFILE_CSS, PUBLIC_HERO_CSS, ADMIN_CSS]

// Only the bare "phone" blocks, not the combined touch block (which starts with the same text).
function getStrictPhoneBlock(css: string) {
  const blocks: string[] = []
  let from = 0

  for (;;) {
    const start = css.indexOf(`@media ${PHONE}`, from)
    if (start === -1) break
    const header = css.slice(start, css.indexOf('{', start))
    const body = getMediaBlocks(css.slice(start), PHONE)[0] ?? ''

    if (header.trim() === `@media ${PHONE}`) blocks.push(body)
    from = start + 1
  }

  return blocks.join('\n')
}

function getTouchBlock(css: string) {
  return getMediaBlocks(css, TOUCH).join('\n')
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const now = new Date('2026-06-25T12:00:00.000Z').toISOString()
const abrams = HEROES[0]
const previewHero = HEROES[1]
const tapHero = HEROES[2]

const profileData: UserProfileData = {
  user: {
    id: 'user_1',
    clerkId: 'clerk_1',
    email: 'tril@example.com',
    username: 'TRIL',
    registeredUsername: 'TRIL',
    preferredHero: abrams.slug,
    profileBackground: `official:${abrams.slug}`,
    isPublic: true,
    anonymousEdits: false,
    customBio: 'hi',
    createdAt: now,
    updatedAt: now,
  },
  viewerIsOwner: true,
  viewerIsSignedIn: true,
  avatarUrl: null,
  preferredHero: abrams,
  profileBackground: {
    id: `official:${abrams.slug}`,
    label: abrams.displayName,
    render: abrams.render,
    accent: abrams.heroInfo.tagColor,
    nameColor: abrams.heroInfo.nameColor,
  },
  authoredHeroes: [
    {
      id: 'hero_1',
      name: 'Asasvc',
      slug: 'asasvc',
      portrait: abrams.portrait,
      render: abrams.render,
      background: abrams.render,
      updatedAt: now,
      status: 'published',
      moderationStatus: 'clean',
    },
  ],
  savedHeroes: [
    {
      id: 'hero_1',
      creatorId: 'clerk_1',
      slug: 'asasvc',
      assetSlug: 'asasvc',
      displayName: 'Asasvc',
      portrait: abrams.portrait,
      render: abrams.render,
      background: abrams.render,
      heroInfo: abrams.heroInfo,
      status: 'published',
      likesCount: 0,
      likedByCurrentUser: false,
      bookmarkedByCurrentUser: false,
      allowCopies: true,
      viewerCanEdit: true,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ],
  bookmarkedHeroes: [],
  privateHeroes: [],
  viewerFollowsUser: false,
  followerCount: 4,
  level: {
    label: 'Power User',
    tone: 'lead',
    nextAt: 51,
    progress: 65,
  },
  charactersCreated: 1,
  userContributions: 9,
}

// ---------------------------------------------------------------------------
// CSS contracts
// ---------------------------------------------------------------------------

describe('mobile profile pages: CSS contracts', () => {
  it('pairs every 100vh with a 100dvh declaration (D6)', () => {
    for (const path of STEP_SIX_CSS) {
      const css = readCss(path)
      const vhCount = (css.match(/100vh/g) ?? []).length
      const dvhCount = (css.match(/100dvh/g) ?? []).length

      expect(vhCount, path).toBeGreaterThan(0)
      expect(dvhCount, path).toBe(vhCount)
    }
  })

  it('keeps the first content block clear of the floating GlobalNav on phone (A6)', () => {
    expect(getRule(getStrictPhoneBlock(readCss(PUBLIC_PROFILE_CSS)), '.content')).toMatch(SAFE_TOP_56)
    expect(getRule(getStrictPhoneBlock(readCss(PUBLIC_HERO_CSS)), '.content')).toMatch(SAFE_TOP_56)
    expect(getRule(getStrictPhoneBlock(readCss(ADMIN_CSS)), '.shell')).toMatch(SAFE_TOP_56)
    expect(getRule(getStrictPhoneBlock(readCss(USER_PROFILE_CSS)), '.content')).toMatch(/calc\(76px \+ var\(--safe-top, 0px\)\)/)
    expect(getRule(getStrictPhoneBlock(readCss(PROFILE_SETTINGS_CSS)), '.content')).toMatch(/calc\(76px \+ var\(--safe-top, 0px\)\)/)
  })

  it('raises owner profile controls to 44px touch targets', () => {
    const css = readCss(USER_PROFILE_CSS)
    const touch = getTouchBlock(css)

    for (const selector of [
      '.sidePanelItem',
      '.bulkHeroToolbar button',
      '.backgroundSummary button',
      '.backgroundTabs button',
      '.segmentedControl button',
      '.notificationToolbar select',
      '.notificationToolbar button',
      '.notificationRow button',
      '.rowActions button',
      '.ledgerRow a',
      '.backgroundConfirmButton',
      '.deleteHeroConfirmButton',
      '.avatarEditButton',
    ]) {
      expect(getRule(touch, selector), selector).toMatch(TOUCH_MIN_HEIGHT)
    }

    expect(getRule(touch, '.modalCloseButton')).toMatch(/width:\s*var\(--touch-target, 44px\);[\s\S]*height:\s*var\(--touch-target, 44px\)/)
    expect(getRule(touch, '.backButton')).toMatch(/height:\s*var\(--touch-target, 44px\)/)

    const coarse = getMediaBlocks(css, '(pointer: coarse) {').join('\n')

    expect(getRule(coarse, '.cardDeleteButton')).toMatch(/width:\s*40px;[\s\S]*height:\s*40px/)
    // The desktop base rule asserted by user-profile.test.tsx stays at 36px.
    expect(getRule(css, '.cardDeleteButton')).toMatch(/width:\s*36px/)
  })

  it('stacks the cramped comment rows and sizes profile modals for phones', () => {
    const css = readCss(USER_PROFILE_CSS)
    const phone = getStrictPhoneBlock(css)

    expect(getRule(phone, '.commentRow')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(getRule(css, '.modalBackdrop')).toMatch(/z-index:\s*400/)

    const modalRule = getRule(phone, '.backgroundModal')

    expect(modalRule).toMatch(/max-height:\s*calc\(100dvh - var\(--safe-top, 0px\) - var\(--safe-bottom, 0px\) - 24px\)/)
    expect(modalRule).toMatch(/overflow-y:\s*auto/)
    expect(modalRule).toMatch(/overscroll-behavior:\s*contain/)
    expect(getRule(phone, '.backgroundModalHeader')).toMatch(/position:\s*sticky/)
    expect(getRule(phone, '.backgroundOptions')).toMatch(/minmax\(min\(220px, 100%\), 1fr\)/)
  })

  it('raises settings, public profile, and public hero targets to 44px', () => {
    expect(getRule(getTouchBlock(readCss(PROFILE_SETTINGS_CSS)), '.toggle')).toMatch(TOUCH_MIN_HEIGHT)
    expect(getRule(getTouchBlock(readCss(PUBLIC_PROFILE_CSS)), '.followControl button')).toMatch(TOUCH_MIN_HEIGHT)
    expect(getRule(getTouchBlock(readCss(PUBLIC_PROFILE_CSS)), '.followControl a')).toMatch(TOUCH_MIN_HEIGHT)
    // .actionButton covers hero actions, guest /sign-up links, and the comment submit button.
    expect(getRule(getTouchBlock(readCss(PUBLIC_HERO_CSS)), '.actionButton')).toMatch(TOUCH_MIN_HEIGHT)
  })

  it('lets public hero sections and the comment form fit a 360px phone', () => {
    const phone = getStrictPhoneBlock(readCss(PUBLIC_HERO_CSS))

    expect(getRule(phone, '.abilityList')).toMatch(/minmax\(min\(240px, 100%\), 1fr\)/)
    expect(getRule(phone, '.statGroups')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(getRule(phone, '.commentForm textarea')).toMatch(/font-size:\s*16px/)
    expect(getRule(phone, '.commentFormFooter')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('wraps the admin queue tabs in a horizontal scroller and sizes moderation actions', () => {
    const css = readCss(ADMIN_CSS)
    const phone = getStrictPhoneBlock(css)
    const sidebarRules = phone.match(/(?:^|[\s,}])\.sidebar\s*\{([^}]*)\}/g)?.join('\n') ?? ''

    expect(sidebarRules).toMatch(/overflow-x:\s*auto/)
    expect(sidebarRules).toMatch(/overscroll-behavior-x:\s*contain/)
    expect(getRule(phone, '.heroGrid')).toMatch(/minmax\(min\(290px, 100%\), 1fr\)/)
    expect(getRule(getTouchBlock(css), '.item footer button')).toMatch(TOUCH_MIN_HEIGHT)
    expect(getRule(getTouchBlock(css), '.item summary')).toMatch(TOUCH_MIN_HEIGHT)
    expect(getRule(getTouchBlock(css), '.header a')).toMatch(TOUCH_MIN_HEIGHT)
  })

  it('adds no fixed pixel widths or unclamped grid minimums in the phone blocks', () => {
    for (const path of STEP_SIX_CSS) {
      const phone = getStrictPhoneBlock(readCss(path))

      expect(phone, path).not.toBe('')

      for (const match of phone.matchAll(/(?<![\w-])(?:min-)?width:\s*(\d+)px/g)) {
        expect(Number(match[1]), `${path}: ${match[0]}`).toBeLessThanOrEqual(104)
      }

      // Any grid minimum over 200px must be clamped with min(..., 100%).
      for (const match of phone.matchAll(/minmax\((\d+)px/g)) {
        expect(Number(match[1]), `${path}: ${match[0]}`).toBeLessThan(200)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Input attributes
// ---------------------------------------------------------------------------

describe('mobile profile pages: input attributes', () => {
  it('turns off capitalization and autocorrect on the username field', () => {
    render(<ProfileSettingsPanel user={profileData.user} heroes={HEROES} />)

    const username = screen.getByRole('textbox', { name: 'Profile Username' })

    expect(username).toHaveAttribute('autocapitalize', 'none')
    expect(username).toHaveAttribute('autocorrect', 'off')
    expect(username).toHaveAttribute('spellcheck', 'false')
    expect(username).toHaveAttribute('autocomplete', 'username')

    const confirmation = screen.getByRole('textbox', { name: 'Delete account confirmation' })

    expect(confirmation).toHaveAttribute('autocapitalize', 'none')
    expect(confirmation).toHaveAttribute('spellcheck', 'false')
  })

  it('types any URL fields in profile settings as url', () => {
    const { container } = render(<ProfileSettingsPanel user={profileData.user} heroes={HEROES} />)
    const urlLikeInputs = [...container.querySelectorAll('input')]
      .filter(input => /url|link|website|homepage/i.test(`${input.name} ${input.id}`))

    // Settings has no URL fields today; any added later must use type="url".
    for (const input of urlLikeInputs) {
      expect(input).toHaveAttribute('type', 'url')
    }
  })

  it('treats the creator search as a username field', () => {
    render(<ProfileUnavailable reason="missing" />)

    const search = screen.getByRole('searchbox', { name: 'Find another creator' })

    expect(search).toHaveAttribute('autocapitalize', 'none')
    expect(search).toHaveAttribute('autocorrect', 'off')
    expect(search).toHaveAttribute('spellcheck', 'false')
  })

  it('renders the comment textarea with mobile text hints and a styled submit button', () => {
    render(<PublicHeroCommentForm heroId="hero_1" isSignedIn />)

    const textarea = screen.getByRole('textbox', { name: 'Add a comment' })

    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveAttribute('autocapitalize', 'sentences')
    expect(textarea).toHaveAttribute('spellcheck', 'true')
    expect(textarea).toHaveAttribute('maxlength', '500')

    const submit = screen.getByRole('button', { name: 'Post comment' })

    expect(submit).toHaveAttribute('type', 'submit')
    expect(submit.className).toMatch(/actionButton/)
  })
})

// ---------------------------------------------------------------------------
// Background preview: mouse hover, touch tap, keyboard focus
// ---------------------------------------------------------------------------

describe('mobile profile pages: background preview', () => {
  async function openPicker() {
    const user = userEvent.setup()

    render(<UserProfile data={profileData} heroes={HEROES} />)
    await user.click(screen.getByRole('button', { name: /change background/i }))

    return { user, background: screen.getByTestId('profile-background-render') }
  }

  function getOption(name: string) {
    return within(screen.getByRole('dialog', { name: 'Profile Background' }))
      .getByRole('button', { name: new RegExp(`^${name}$`, 'i') })
  }

  it('ignores touch and pen pointer-enter so a single tap selects the background', async () => {
    const { background } = await openPicker()
    const option = getOption(tapHero.displayName)

    fireEvent.pointerEnter(option, { pointerType: 'touch' })
    expect(background).toHaveAttribute('src', abrams.render)

    fireEvent.pointerEnter(option, { pointerType: 'pen' })
    expect(background).toHaveAttribute('src', abrams.render)

    fireEvent.click(option)

    expect(option).toHaveAttribute('aria-pressed', 'true')
    expect(background).toHaveAttribute('src', tapHero.render)

    fireEvent.pointerLeave(option, { pointerType: 'touch' })
    expect(background).toHaveAttribute('src', tapHero.render)
  })

  it('still previews on mouse hover and restores the draft on mouse leave', async () => {
    const { background } = await openPicker()
    const option = getOption(previewHero.displayName)

    fireEvent.pointerEnter(option, { pointerType: 'mouse' })
    expect(background).toHaveAttribute('src', previewHero.render)
    expect(option).toHaveAttribute('aria-pressed', 'false')

    fireEvent.pointerLeave(option, { pointerType: 'mouse' })
    expect(background).toHaveAttribute('src', abrams.render)
  })

  it('previews on keyboard focus and restores on blur', async () => {
    const { background } = await openPicker()
    const option = getOption(previewHero.displayName)

    fireEvent.focus(option)
    expect(background).toHaveAttribute('src', previewHero.render)

    fireEvent.blur(option)
    expect(background).toHaveAttribute('src', abrams.render)
  })
})

// ---------------------------------------------------------------------------
// Portaled modals (A1 / A1a)
// ---------------------------------------------------------------------------

describe('mobile profile pages: modal portals', () => {
  it('portals the background picker to document.body with a backdrop marker', async () => {
    const user = userEvent.setup()
    const { container } = render(<UserProfile data={profileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: /change background/i }))

    const dialog = screen.getByRole('dialog', { name: 'Profile Background' })
    const backdrop = dialog.closest('[data-modal-backdrop="true"]')

    expect(backdrop).not.toBeNull()
    expect(backdrop?.parentElement).toBe(document.body)
    expect(container.contains(dialog)).toBe(false)

    await user.click(backdrop as HTMLElement)

    expect(screen.queryByRole('dialog', { name: 'Profile Background' })).not.toBeInTheDocument()
  })

  it('portals the delete confirmation and keeps clicks inside the dialog from closing it', async () => {
    const user = userEvent.setup()
    const { container } = render(<UserProfile data={profileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: 'Delete character Asasvc' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Asasvc?' })
    const backdrop = dialog.closest('[data-modal-backdrop="true"]')

    expect(backdrop?.parentElement).toBe(document.body)
    expect(container.contains(dialog)).toBe(false)

    await user.click(within(dialog).getByText(/cannot be undone/i))
    expect(screen.getByRole('dialog', { name: 'Delete Asasvc?' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Close hero deletion confirmation' }))
    expect(screen.queryByRole('dialog', { name: 'Delete Asasvc?' })).not.toBeInTheDocument()
  })
})
