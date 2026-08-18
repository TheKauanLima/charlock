// @vitest-environment jsdom

import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PublicUserProfile from '@/components/UserProfile/PublicUserProfile'
import { HEROES } from '@/lib/hero-data'
import type { UserProfileData } from '@/lib/profile'

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
const publicProfileData: UserProfileData = {
  user: {
    id: 'mongo_creator',
    clerkId: 'clerk_creator',
    email: 'private@example.com',
    username: 'Rift Smith',
    preferredHero: abrams.slug,
    profileBackground: `official:${abrams.slug}`,
    isPublic: true,
    anonymousEdits: false,
    customBio: 'Builds heroes around battlefield control.',
    createdAt: now,
    updatedAt: now,
  },
  viewerIsOwner: false,
  avatarUrl: 'https://example.com/rift.png',
  preferredHero: abrams,
  profileBackground: {
    id: `official:${abrams.slug}`,
    label: abrams.displayName,
    render: abrams.render,
    accent: abrams.heroInfo.tagColor,
    nameColor: abrams.heroInfo.nameColor,
  },
  authoredHeroes: [{
    id: 'public_hero_1',
    name: 'Arc Light',
    slug: 'arc-light',
    portrait: abrams.portrait,
    render: abrams.render,
    background: '/selected-arc-light-background.png',
    updatedAt: now,
    status: 'published',
    moderationStatus: 'clean',
  }],
  savedHeroes: [],
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
    expect(screen.getByRole('link', { name: 'Open character Arc Light' })).toHaveAttribute('href', '/?tab=browse&heroId=public_hero_1')
    expect(screen.getByTestId('public-hero-background-public_hero_1')).toHaveStyle({
      backgroundImage: "url('/selected-arc-light-background.png')",
    })
    expect(screen.getByTestId('public-hero-background-public_hero_1')).not.toHaveStyle({
      backgroundImage: `url('${abrams.render}')`,
    })
    expect(screen.getByRole('button', { name: 'Follow Rift Smith' })).toBeInTheDocument()

    expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/security/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/delete account/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete character/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit picture/i })).not.toBeInTheDocument()
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
})
