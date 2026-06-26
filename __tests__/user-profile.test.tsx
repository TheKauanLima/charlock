// @vitest-environment jsdom

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserProfile from '@/components/UserProfile/UserProfile'
import type { UserProfileData } from '@/lib/profile'
import { HEROES } from '@/lib/hero-data'
import { updateProfileBackground } from '@/app/profile/actions'

const openUserProfileMock = vi.hoisted(() => vi.fn())

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }

    delete imageProps.fill
    delete imageProps.priority

    return React.createElement('img', imageProps)
  },
}))

vi.mock('@/app/profile/actions', () => ({
  deleteAccount: vi.fn(async () => undefined),
  updateProfileBackground: vi.fn(async () => undefined),
  updateProfileSettings: vi.fn(async () => undefined),
}))

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({
    openUserProfile: openUserProfileMock,
  }),
}))

const now = new Date('2026-06-25T12:00:00.000Z').toISOString()
const abrams = HEROES[0]

const profileData: UserProfileData = {
  user: {
    id: 'user_1',
    clerkId: 'clerk_1',
    email: 'tril@example.com',
    username: 'TRIL',
    preferredHero: abrams.slug,
    profileBackground: `official:${abrams.slug}`,
    isPublic: true,
    anonymousEdits: false,
    customBio: 'hi',
    createdAt: now,
    updatedAt: now,
  },
  viewerIsOwner: true,
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
      updatedAt: now,
      status: 'published',
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
  bookmarkedHeroes: [
    {
      id: 'hero_2',
      creatorId: 'clerk_2',
      slug: 'bookmark',
      assetSlug: 'bookmark',
      displayName: 'Bookmark Hero',
      portrait: HEROES[1].portrait,
      render: HEROES[1].render,
      background: HEROES[1].render,
      heroInfo: HEROES[1].heroInfo,
      status: 'published',
      likesCount: 3,
      likedByCurrentUser: true,
      bookmarkedByCurrentUser: true,
      allowCopies: true,
      viewerCanEdit: false,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ],
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

describe('UserProfile', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/profile/TRIL')
  })

  it('renders the streamlined profile layout with persistent tab navigation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = input.toString()

      if (url.includes('/likes')) {
        return Response.json({
          likes: [
            {
              id: 'like_1',
              heroId: 'hero_2',
              heroName: 'Bookmark Hero',
              creatorId: 'clerk_2',
              creatorName: 'RIFT',
              likedAt: now,
              href: '/?tab=browse&heroId=hero_2',
            },
          ],
        })
      }

      if (url.includes('/comments')) {
        return Response.json({
          comments: {
            made: [
              {
                id: 'comment_1',
                heroId: 'hero_2',
                heroName: 'Bookmark Hero',
                authorId: 'clerk_1',
                authorName: 'TRIL',
                content: 'Clean kit.',
                createdAt: now,
                href: '/?tab=browse&heroId=hero_2',
                viewerCanDelete: true,
              },
            ],
            received: [
              {
                id: 'comment_2',
                heroId: 'hero_1',
                heroName: 'Asasvc',
                authorId: 'clerk_2',
                authorName: 'RIFT',
                content: 'Needs a sharper ultimate.',
                createdAt: now,
                href: '/?tab=browse&heroId=hero_1',
                viewerCanDelete: true,
              },
            ],
          },
        })
      }

      if (url.includes('/feed')) {
        return Response.json({
          items: [
            {
              id: 'comment:comment_2',
              type: 'comment',
              createdAt: now,
              heroId: 'hero_1',
              heroName: 'Asasvc',
              actorId: 'clerk_2',
              actorName: 'RIFT',
              content: 'Needs a sharper ultimate.',
            },
          ],
        })
      }

      return Response.json({})
    })

    render(<UserProfile data={profileData} heroes={HEROES} />)

    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TRIL' })).toBeInTheDocument()
    expect(screen.getByText('4 followers')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to site/i })).toHaveAttribute('href', '/')
    expect(screen.queryByText(/user contributions/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/user progress/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/last updated/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/power user/i)).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /saved characters/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /bookmarks/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /likes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comments/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()

    expect(screen.getByText('1 total')).toBeInTheDocument()
    expect(screen.getByText('Profile Background')).toBeInTheDocument()
    expect(screen.getByText(abrams.displayName)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit picture/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /edit picture/i }))
    expect(openUserProfileMock).toHaveBeenCalled()

    expect(screen.queryByText('Main Characters')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /change background/i }))
    expect(screen.getByText('Main Characters')).toBeInTheDocument()
    expect(screen.getByText('Created Characters')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open character asasvc/i })).toHaveAttribute('href', '/?tab=create&heroId=hero_1')

    await user.click(screen.getByRole('button', { name: /asasvc/i }))

    expect(updateProfileBackground).toHaveBeenCalledWith('custom:hero_1')

    await user.click(screen.getByRole('button', { name: /bookmarks/i }))

    expect(screen.getByRole('button', { name: /bookmarks/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Bookmarks')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /open character bookmark hero/i })).toHaveAttribute('href', '/?tab=bookmarks&heroId=hero_2')

    await user.click(screen.getByRole('button', { name: /likes/i }))
    expect(await screen.findByText(/RIFT/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view bookmark hero/i })).toHaveAttribute('href', '/?tab=browse&heroId=hero_2')

    await user.click(screen.getByRole('button', { name: /comments/i }))
    expect(await screen.findByText('Clean kit.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /comments received/i }))
    expect(screen.getByText(/needs a sharper ultimate/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    const notificationText = await screen.findByText(/commented on Asasvc/i)

    expect(notificationText).toBeInTheDocument()
    expect(notificationText.closest('a')).toBeNull()

    await user.click(screen.getByRole('button', { name: /settings/i }))

    await waitFor(() => expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()

    fetchMock.mockRestore()
  })

  it('shows themed empty and error states for profile ledgers', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ likes: [] }))
      .mockResolvedValueOnce(Response.json({ error: 'down' }, { status: 500 }))

    render(<UserProfile data={profileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: /likes/i }))
    expect(await screen.findByText('You have not liked any characters yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /comments/i }))
    expect(await screen.findByText('Unable to retrieve grid entries. Server link severed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument()

    fetchMock.mockRestore()
  })

  it('restores a hash-linked profile tab after mount without changing the initial render', async () => {
    window.history.replaceState(null, '', '/profile/TRIL#notifications')

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      items: [
        {
          id: 'hero:hero_1',
          type: 'published_hero',
          createdAt: now,
          heroId: 'hero_1',
          heroName: 'Asasvc',
          actorId: 'clerk_1',
          actorName: 'TRIL',
        },
      ],
    }))

    render(<UserProfile data={profileData} heroes={HEROES} />)

    expect(screen.getByRole('button', { name: /saved characters/i })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: /notifications/i })).toHaveAttribute('aria-pressed', 'true'))
    expect(await screen.findByText(/published Asasvc/i)).toBeInTheDocument()

    fetchMock.mockRestore()
  })
})
