// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }),
}))

import PublicHeroActions from '@/components/PublicHero/PublicHeroActions'
import PublicHeroCommentForm from '@/components/PublicHero/PublicHeroCommentForm'
import type { PublicHeroViewer } from '@/lib/public-page-types'

const GUEST: PublicHeroViewer = { isSignedIn: false, isOwner: false, liked: false, bookmarked: false }
const SIGNED_IN: PublicHeroViewer = { isSignedIn: true, isOwner: false, liked: false, bookmarked: false }
const OWNER: PublicHeroViewer = { isSignedIn: true, isOwner: true, liked: false, bookmarked: false }
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

function renderActions(props: Partial<Parameters<typeof PublicHeroActions>[0]> = {}) {
  return render(
    <PublicHeroActions
      heroId="hero_1"
      heroName="Arc Light"
      likesCount={3}
      allowCopies
      viewer={SIGNED_IN}
      visibility="public"
      {...props}
    />,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mocks.refresh.mockReset()
})

describe('PublicHeroActions', () => {
  it('gives guests sign-up links with accessible labels and never calls the APIs', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    renderActions({ viewer: GUEST })

    for (const name of [
      'Sign up to like Arc Light',
      'Sign up to bookmark Arc Light',
      'Sign up to comment on Arc Light',
      'Sign up to use Arc Light as a template',
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', '/sign-up')
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('public-hero-like-count')).toHaveTextContent('3 likes')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hides the template control when copies are not allowed', () => {
    renderActions({ viewer: GUEST, allowCopies: false })

    expect(screen.queryByRole('link', { name: /template/i })).not.toBeInTheDocument()
  })

  it('likes a hero with a JSON POST and uses the server like count', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      hero: { id: 'hero_1', likesCount: 10, likedByCurrentUser: true },
    }))

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Like Arc Light' }))

    await waitFor(() => expect(screen.getByTestId('public-hero-like-count')).toHaveTextContent('10 likes'))
    expect(screen.getByRole('button', { name: 'Unlike Arc Light' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/hero_1/like', expect.objectContaining({
      method: 'POST',
      headers: JSON_HEADERS,
    }))
  })

  it('toggles a bookmark with a JSON POST', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      bookmark: { heroId: 'hero_1', bookmarked: true },
    }))

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Bookmark Arc Light' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Arc Light bookmark' })).toHaveAttribute('aria-pressed', 'true'))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/hero_1/bookmark', expect.objectContaining({
      method: 'POST',
      headers: JSON_HEADERS,
    }))
  })

  it('links signed-in users to the comments section and the template', () => {
    renderActions()

    expect(screen.getByRole('link', { name: 'Comment on Arc Light' })).toHaveAttribute('href', '#comments')
    expect(screen.getByRole('link', { name: 'Use Arc Light as a template' })).toHaveAttribute('href', '/?tab=browse&heroId=hero_1')
  })

  it('rolls back the optimistic like and shows a session message on 401', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, { status: 401 }))

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Like Arc Light' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Your session expired. Sign in again to continue.')
    expect(screen.getByTestId('public-hero-like-count')).toHaveTextContent('3 likes')
    expect(screen.getByRole('button', { name: 'Like Arc Light' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('rolls back the bookmark and shows a rate-limit message on 429', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Slow down' }, { status: 429 }))

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Bookmark Arc Light' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Too many requests. Wait a moment, then try again.')
    expect(screen.getByRole('button', { name: 'Bookmark Arc Light' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a network error as a status message', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Like Arc Light' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Failed to fetch')
    expect(screen.getByTestId('public-hero-like-count')).toHaveTextContent('3 likes')
  })

  it.each(['owner-private', 'owner-hidden'] as const)('shows the owner only the template link for %s heroes', visibility => {
    renderActions({ viewer: OWNER, visibility })

    expect(screen.getByRole('link', { name: 'Use Arc Light as a template' })).toHaveAttribute('href', '/?tab=browse&heroId=hero_1')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /comment/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('public-hero-like-count')).not.toBeInTheDocument()
  })

  it.each(['public', 'owner-private', 'owner-hidden'] as const)('shows the owner the template link with copies disabled (%s)', visibility => {
    renderActions({ viewer: OWNER, visibility, allowCopies: false })

    expect(screen.getByRole('link', { name: 'Use Arc Light as a template' })).toHaveAttribute('href', '/?tab=browse&heroId=hero_1')
  })

  it('hides the template link from a signed-in non-owner when copies are disabled', () => {
    renderActions({ viewer: SIGNED_IN, allowCopies: false })

    expect(screen.queryByRole('link', { name: /template/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Like Arc Light' })).toBeInTheDocument()
  })

  it('gives the owner of a public hero the same actions as other signed-in users', () => {
    renderActions({ viewer: OWNER })

    expect(screen.getByRole('button', { name: 'Like Arc Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bookmark Arc Light' })).toBeInTheDocument()
  })
})

describe('PublicHeroCommentForm', () => {
  it('shows guests a sign-up link instead of the form', () => {
    render(<PublicHeroCommentForm heroId="hero_1" isSignedIn={false} />)

    expect(screen.getByRole('link', { name: 'Sign up to comment' })).toHaveAttribute('href', '/sign-up')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('posts a comment as JSON and refreshes the server-rendered list on 201', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ comment: { id: 'c1' } }, { status: 201 }))

    render(<PublicHeroCommentForm heroId="hero_1" isSignedIn />)

    const textarea = screen.getByRole('textbox', { name: 'Add a comment' })

    expect(textarea).toHaveAttribute('maxLength', '500')
    await user.type(textarea, '  Great kit.  ')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/hero_1/comments', expect.objectContaining({
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ content: 'Great kit.' }),
    }))
    expect(textarea).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('Comment posted.')
  })

  it('does not post an empty comment', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    render(<PublicHeroCommentForm heroId="hero_1" isSignedIn />)
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(screen.getByRole('status')).toHaveTextContent('Write a comment before posting.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the draft and shows an error on 429', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Slow down' }, { status: 429 }))

    render(<PublicHeroCommentForm heroId="hero_1" isSignedIn />)
    await user.type(screen.getByRole('textbox', { name: 'Add a comment' }), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Too many requests. Wait a moment, then try again.')
    expect(screen.getByRole('textbox', { name: 'Add a comment' })).toHaveValue('Hello')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
