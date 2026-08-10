// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const heroGridMock = vi.hoisted(() => vi.fn(() => <div data-testid="hero-grid" />))
const authenticatedHomeMock = vi.hoisted(() => vi.fn(() => <div data-testid="authenticated-home" />))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('@/components/HeroGrid/HeroGrid', () => ({
  default: heroGridMock,
}))

vi.mock('@/components/auth/AuthenticatedHome', () => ({
  default: authenticatedHomeMock,
}))

import Home from '@/app/page'

beforeEach(() => {
  authMock.mockReset()
  heroGridMock.mockClear()
  authenticatedHomeMock.mockClear()
})

describe('Home auth gate', () => {
  it('defers signed-out routing to the live client session gate', async () => {
    authMock.mockResolvedValueOnce({ userId: null })

    render(await Home())

    expect(screen.getByTestId('authenticated-home')).toBeInTheDocument()
    expect(authenticatedHomeMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialTab: 'Select' }),
      undefined,
    )
    expect(heroGridMock).not.toHaveBeenCalled()
  })

  it('renders the hero grid for signed-in users', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_123' })

    render(await Home())

    expect(screen.getByTestId('hero-grid')).toBeInTheDocument()
  })

  it('passes the create tab from search params into the hero grid', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_123' })

    render(await Home({ searchParams: Promise.resolve({ tab: 'create' }) }))

    expect(screen.getByTestId('hero-grid')).toBeInTheDocument()
    expect(heroGridMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialTab: 'Create' }),
      undefined,
    )
  })

  it('passes a profile edit hero id into the hero grid', async () => {
    authMock.mockResolvedValueOnce({ userId: 'user_123' })

    render(await Home({ searchParams: Promise.resolve({ tab: 'create', heroId: 'hero_123' }) }))

    expect(heroGridMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialTab: 'Create', initialHeroId: 'hero_123' }),
      undefined,
    )
  })

  it('passes profile-menu tab routes into the hero grid', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' })

    render(await Home({ searchParams: Promise.resolve({ tab: 'bookmarks' }) }))
    expect(heroGridMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialTab: 'Bookmarks' }),
      undefined,
    )

    render(await Home({ searchParams: Promise.resolve({ tab: 'notifications' }) }))
    expect(heroGridMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialTab: 'Notifications' }),
      undefined,
    )
  })
})
