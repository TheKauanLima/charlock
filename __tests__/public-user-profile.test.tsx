// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PublicUserProfile from '@/components/UserProfile/PublicUserProfile'
import { HEROES } from '@/lib/hero-data'
import type { PublicProfileView } from '@/lib/public-page-types'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean; unoptimized?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.preload
    delete imageProps.unoptimized

    return React.createElement('img', imageProps)
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const now = new Date('2026-08-12T12:00:00.000Z').toISOString()
const abrams = HEROES[0]
const publicProfileData: PublicProfileView = {
  username: 'Rift Smith',
  followTargetId: 'clerk_creator',
  avatarUrl: 'https://example.com/rift.png',
  bio: 'Builds heroes around battlefield control.',
  profileBackground: {
    id: `official:${abrams.slug}`,
    label: abrams.displayName,
    render: abrams.render,
    accent: abrams.heroInfo.tagColor,
    nameColor: abrams.heroInfo.nameColor,
  },
  level: {
    label: 'Power User',
    tone: 'lead',
    nextAt: 51,
    progress: 65,
  },
  charactersCreated: 1,
  userContributions: 9,
  followerCount: 4,
  viewer: { isSignedIn: true, follows: false },
  heroes: [
    {
      id: 'public_hero_1',
      name: 'Arc Light',
      slug: 'arc-light',
      href: '/characters/arc-light',
      portrait: abrams.portrait,
      render: abrams.render,
      background: '/selected-arc-light-background.png',
      updatedAt: now,
    },
    {
      id: 'legacy_hero_2',
      name: 'Legacy Slug',
      slug: 'Legacy Slug!',
      href: '/?tab=browse&heroId=legacy_hero_2',
      portrait: abrams.portrait,
      render: abrams.render,
      background: '/legacy-background.png',
      updatedAt: now,
    },
  ],
}

describe('PublicUserProfile', () => {
  it('renders a read-only creator page without owner settings or deletion controls', () => {
    render(<PublicUserProfile data={publicProfileData} />)

    expect(screen.getByText('Public Creator Profile')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rift Smith' })).toBeInTheDocument()
    expect(screen.getByText('Builds heroes around battlefield control.')).toBeInTheDocument()
    expect(screen.getByText('Characters Created')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.queryByText('Power User')).not.toBeInTheDocument()
    expect(screen.queryByText('Backstories Written')).not.toBeInTheDocument()
    expect(screen.queryByText('Contribution Rank')).not.toBeInTheDocument()
    expect(screen.queryByText('Main Hero')).not.toBeInTheDocument()
    expect(screen.getByText('2 public')).toBeInTheDocument()
    expect(screen.getByTestId('public-hero-background-public_hero_1')).toHaveStyle({
      backgroundImage: "url('/selected-arc-light-background.png')",
    })
    expect(screen.getByTestId('public-hero-background-public_hero_1')).not.toHaveStyle({
      backgroundImage: `url('${abrams.render}')`,
    })
    expect(screen.getByRole('button', { name: 'Follow Rift Smith' })).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/security/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/delete account/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete character/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit picture/i })).not.toBeInTheDocument()
  })

  it('links character cards to the public hero page, or the browse template link for legacy slugs', () => {
    render(<PublicUserProfile data={publicProfileData} />)

    expect(screen.getByRole('link', { name: 'Open character Arc Light' })).toHaveAttribute('href', '/characters/arc-light')
    expect(screen.getByRole('link', { name: 'Open character Legacy Slug' })).toHaveAttribute('href', '/?tab=browse&heroId=legacy_hero_2')
  })

  it('does not render email, Mongo ids, or private hero lists', () => {
    const { container } = render(<PublicUserProfile data={publicProfileData} />)
    const html = container.innerHTML

    expect(html).not.toContain('@example.com')
    expect(html).not.toContain('mongo_')
    expect(html).not.toContain('clerk_creator')
  })

  it('keeps follow interaction available without exposing profile editing', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      follow: {
        following: true,
        followerCount: 5,
      },
    }))

    render(<PublicUserProfile data={publicProfileData} />)
    await user.click(screen.getByRole('button', { name: 'Follow Rift Smith' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Unfollow Rift Smith' })).toHaveTextContent('Following'))
    expect(screen.getByText('5 followers')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/users/clerk_creator/follow', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  })

  it('turns a failed follow network request into an inline status instead of an unhandled error', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.'))

    render(<PublicUserProfile data={publicProfileData} />)
    await user.click(screen.getByRole('button', { name: 'Follow Rift Smith' }))

    expect(await screen.findByRole('status')).toHaveTextContent('NetworkError when attempting to fetch resource.')
    expect(screen.getByRole('button', { name: 'Follow Rift Smith' })).toBeEnabled()
  })

  it('shows a rate-limit message when the follow API returns 429', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 }))

    render(<PublicUserProfile data={publicProfileData} />)
    await user.click(screen.getByRole('button', { name: 'Follow Rift Smith' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Too many requests. Wait a moment, then try again.')
    expect(screen.getByText('4 followers')).toBeInTheDocument()
  })

  it('gives guests a sign-up link instead of the follow request and keeps the follower count', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    render(<PublicUserProfile data={{ ...publicProfileData, viewer: { isSignedIn: false, follows: false } }} />)

    const followLink = screen.getByRole('link', { name: 'Sign up to follow Rift Smith' })

    expect(followLink).toHaveAttribute('href', '/sign-up')
    expect(followLink).toHaveTextContent('Follow Creator')
    expect(screen.getByText('4 followers')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Follow Rift Smith' })).not.toBeInTheDocument()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
