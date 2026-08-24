// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    delete (imageProps as Record<string, unknown>).preload

    return React.createElement('img', imageProps)
  },
}))

vi.mock('@/app/profile/actions', () => ({
  deleteAccount: vi.fn(async () => undefined),
  updateProfileBackground: vi.fn(async (backgroundId: string) => ({ success: true, backgroundId })),
  updateProfileSettings: vi.fn(async () => undefined),
  updateUsername: vi.fn(async () => undefined),
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
      background: abrams.render,
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
    openUserProfileMock.mockClear()
    vi.mocked(updateProfileBackground).mockImplementation(async backgroundId => ({ success: true, backgroundId }))
    vi.mocked(updateProfileBackground).mockClear()
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

      if (url.includes('/api/notifications')) {
        return Response.json({
          notifications: {
            hasNotifications: true,
            count: 1,
            items: [
              {
                id: 'notification_1',
                type: 'comment',
                read: false,
                createdAt: now,
                relativeTime: '5m ago',
                actorId: 'clerk_2',
                actorName: 'RIFT',
                actorInitials: 'R',
                action: 'commented on Asasvc',
                targetId: 'comment_2',
                relatedHeroId: 'hero_1',
                heroName: 'Asasvc',
                heroAccent: '#d4af37',
                href: '/?tab=browse&heroId=hero_1#comment-comment_2',
              },
            ],
          },
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

    expect(screen.queryByText('Official Characters')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /change background/i }))
    expect(screen.getByRole('tab', { name: /official characters/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /my custom characters/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open character asasvc/i })).toHaveAttribute('href', '/?tab=create&heroId=hero_1')

    await user.click(screen.getByRole('tab', { name: /my custom characters/i }))
    await user.click(screen.getByRole('button', { name: 'Asasvc', exact: true }))
    await user.click(screen.getByRole('button', { name: /confirm background/i }))

    await waitFor(() => expect(updateProfileBackground).toHaveBeenCalledWith('custom:hero_1'))

    await user.click(screen.getByRole('button', { name: /bookmarks/i }))

    expect(screen.getByRole('button', { name: /bookmarks/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Bookmarks')).toHaveLength(2)
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/creator/i)).toBeInTheDocument()
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
    expect(screen.getByLabelText(/filter/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark notification from RIFT as read/i })).toBeInTheDocument()
    expect(notificationText.closest('a')).toBeNull()

    await user.click(screen.getByRole('button', { name: /settings/i }))

    await waitFor(() => expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/profile username/i)).toHaveValue('TRIL')
    expect(screen.getByRole('button', { name: /update username/i })).toBeInTheDocument()

    fetchMock.mockRestore()
  })

  it('formats long profile usernames without compressing them beside the avatar', () => {
    render(<UserProfile data={{
      ...profileData,
      user: {
        ...profileData.user,
        username: 'TRILOGYTHEGAMER2',
      },
    }} heroes={HEROES} />)

    const heading = screen.getByRole('heading', { name: 'TRILOGYTHEGAMER2' })
    const stylesheet = readFileSync('components/UserProfile/UserProfile.module.css', 'utf8')

    expect(heading.className).toContain('sideProfileName')
    expect(heading.className).toContain('sideProfileNameLong')
    expect(stylesheet).toMatch(/\.sideProfileCopy\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*width:\s*100%/)
    expect(stylesheet).toMatch(/\.sideProfileCopy h1\s*\{[\s\S]*overflow-wrap:\s*break-word;[\s\S]*word-break:\s*normal/)
    expect(stylesheet).toMatch(/\.sideProfileNameLong\s*\{[\s\S]*font-size:\s*1\.82rem/)
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

  it('requires confirmation before permanently deleting an owned character', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'hero_1', deleted: true }))

    render(<UserProfile data={profileData} heroes={HEROES} />)

    const deleteButton = screen.getByRole('button', { name: 'Delete character Asasvc' })
    expect(deleteButton).toHaveTextContent('')
    expect(deleteButton.querySelector('.lucide-x')).toBeInTheDocument()
    expect(deleteButton.className).toContain('cardDeleteButton')
    const stylesheet = readFileSync('components/UserProfile/UserProfile.module.css', 'utf8')
    expect(stylesheet).toMatch(/\.cardDeleteButton\s*\{[\s\S]*background:\s*#a52222/)
    expect(stylesheet).toMatch(/\.cardDeleteButton\s*\{[\s\S]*top:\s*10px;[\s\S]*left:\s*10px;[\s\S]*z-index:\s*100/)
    expect(stylesheet).toMatch(/\.cardDeleteButton\s*\{[\s\S]*width:\s*36px;[\s\S]*height:\s*36px/)
    expect(stylesheet).toMatch(/\.profileHeroCard:hover \.cardDeleteButton[\s\S]*opacity:\s*1/)

    await user.hover(screen.getByRole('link', { name: 'Open character Asasvc' }))
    await user.click(deleteButton)
    expect(screen.getByRole('dialog', { name: 'Delete Asasvc?' })).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Delete Asasvc?' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete character Asasvc' }))
    await user.click(screen.getByRole('button', { name: 'Permanently Delete' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes/hero_1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(screen.queryByRole('link', { name: 'Open character Asasvc' })).not.toBeInTheDocument()
    expect(screen.getByText('0 total')).toBeInTheDocument()
  })

  it('selects multiple owned characters and permanently deletes them in one bulk action', async () => {
    const user = userEvent.setup()
    const secondHero = HEROES[1]
    const bulkProfileData: UserProfileData = {
      ...profileData,
      authoredHeroes: [
        ...profileData.authoredHeroes,
        {
          id: 'hero_3',
          name: 'Bulk Second',
          slug: 'bulk-second',
          portrait: secondHero.portrait,
          render: secondHero.render,
          background: secondHero.render,
          updatedAt: now,
          status: 'private',
        },
      ],
      savedHeroes: [
        ...profileData.savedHeroes,
        {
          id: 'hero_3',
          creatorId: 'clerk_1',
          slug: 'bulk-second',
          assetSlug: 'bulk-second',
          displayName: 'Bulk Second',
          portrait: secondHero.portrait,
          render: secondHero.render,
          background: secondHero.render,
          heroInfo: secondHero.heroInfo,
          status: 'private',
          likesCount: 0,
          likedByCurrentUser: false,
          bookmarkedByCurrentUser: false,
          allowCopies: true,
          viewerCanEdit: true,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      charactersCreated: 2,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      ids: ['hero_1', 'hero_3'],
      deletedCount: 2,
    }))

    render(<UserProfile data={bulkProfileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: 'Select Characters' }))

    expect(screen.queryByRole('button', { name: 'Delete character Asasvc' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select character Asasvc' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Select character Bulk Second' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Select All' }))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deselect character Asasvc' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Deselect character Bulk Second' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Delete Selected (2)' }))

    expect(screen.getByRole('dialog', { name: 'Delete 2 characters?' })).toBeInTheDocument()
    expect(screen.getByText(/every selected character/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Permanently Delete 2 Characters' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/heroes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['hero_1', 'hero_3'] }),
    }))
    expect(screen.queryByRole('link', { name: 'Open character Asasvc' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open character Bulk Second' })).not.toBeInTheDocument()
    expect(screen.getByText('0 total')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Select Characters' })).not.toBeInTheDocument()
  })

  it('selects a contiguous character range with Shift-click', async () => {
    const user = userEvent.setup()
    const rangeNames = ['Range One', 'Range Two', 'Range Three', 'Range Four']
    const rangeProfileData: UserProfileData = {
      ...profileData,
      authoredHeroes: rangeNames.map((name, index) => ({
        ...profileData.authoredHeroes[0],
        id: `range_${index + 1}`,
        name,
        slug: `range-${index + 1}`,
        portrait: HEROES[index].portrait,
        render: HEROES[index].render,
      })),
      savedHeroes: rangeNames.map((name, index) => ({
        ...profileData.savedHeroes[0],
        id: `range_${index + 1}`,
        slug: `range-${index + 1}`,
        assetSlug: `range-${index + 1}`,
        displayName: name,
        portrait: HEROES[index].portrait,
        render: HEROES[index].render,
        background: HEROES[index].render,
        heroInfo: HEROES[index].heroInfo,
      })),
      charactersCreated: rangeNames.length,
    }

    render(<UserProfile data={rangeProfileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: 'Select Characters' }))
    await user.click(screen.getByRole('button', { name: 'Select character Range One' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select character Range Four' }), { shiftKey: true })

    expect(screen.getByText('4 selected')).toBeInTheDocument()
    rangeNames.forEach(name => {
      expect(screen.getByRole('button', { name: `Deselect character ${name}` })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('restores a hash-linked profile tab after mount without changing the initial render', async () => {
    window.history.replaceState(null, '', '/profile/TRIL#notifications')

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      notifications: {
        hasNotifications: true,
        count: 1,
        items: [
          {
            id: 'notification_1',
            type: 'publish',
            read: false,
            createdAt: now,
            relativeTime: '1h ago',
            actorId: 'clerk_1',
            actorName: 'TRIL',
            actorInitials: 'T',
            action: 'published Asasvc',
            targetId: 'hero_1',
            relatedHeroId: 'hero_1',
            heroName: 'Asasvc',
            heroAccent: '#d4af37',
            href: '/?tab=browse&heroId=hero_1',
          },
        ],
      },
    }))

    render(<UserProfile data={profileData} heroes={HEROES} />)

    expect(screen.getByRole('button', { name: /saved characters/i })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: /notifications/i })).toHaveAttribute('aria-pressed', 'true'))
    expect(await screen.findByText(/published Asasvc/i)).toBeInTheDocument()

    fetchMock.mockRestore()
  })

  it('previews profile backgrounds on hover and restores the saved background on cancel', async () => {
    const user = userEvent.setup()
    const previewHero = HEROES[1]

    render(<UserProfile data={profileData} heroes={HEROES} />)

    const backgroundImage = screen.getByTestId('profile-background-render')

    expect(backgroundImage).toHaveAttribute('src', abrams.render)

    await user.click(screen.getByRole('button', { name: /change background/i }))
    await user.hover(screen.getByRole('button', { name: new RegExp(previewHero.displayName, 'i') }))

    expect(backgroundImage).toHaveAttribute('src', previewHero.render)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(backgroundImage).toHaveAttribute('src', abrams.render)
    expect(updateProfileBackground).not.toHaveBeenCalled()
  })

  it('shows synchronization feedback while saving a confirmed profile background', async () => {
    const user = userEvent.setup()
    let resolveBackgroundUpdate: (value: { success: true; backgroundId: string }) => void = () => undefined

    vi.mocked(updateProfileBackground).mockImplementationOnce(backgroundId => {
      void backgroundId

      return new Promise<{ success: true; backgroundId: string }>(resolve => {
        resolveBackgroundUpdate = resolve
      })
    })

    render(<UserProfile data={profileData} heroes={HEROES} />)

    await user.click(screen.getByRole('button', { name: /change background/i }))
    await user.click(screen.getByRole('tab', { name: /my custom characters/i }))
    await user.click(screen.getByRole('button', { name: 'Asasvc', exact: true }))
    await user.click(screen.getByRole('button', { name: /confirm background/i }))

    expect(screen.getAllByText(/committing memory core/i).length).toBeGreaterThan(0)

    resolveBackgroundUpdate({ success: true, backgroundId: 'custom:hero_1' })

    expect(await screen.findByText('SYSTEM: Profile configuration synchronized successfully.')).toBeInTheDocument()
    expect(updateProfileBackground).toHaveBeenCalledWith('custom:hero_1')
  })
})
