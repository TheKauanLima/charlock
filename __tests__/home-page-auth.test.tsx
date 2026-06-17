// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
}))
const heroGridMock = vi.hoisted(() => vi.fn(() => <div data-testid="hero-grid" />))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/components/HeroGrid/HeroGrid', () => ({
  default: heroGridMock,
}))

import Home from '@/app/page'

beforeEach(() => {
  authMock.mockReset()
  redirectMock.mockClear()
  heroGridMock.mockClear()
})

describe('Home auth gate', () => {
  it('redirects signed-out visitors to account creation', async () => {
    authMock.mockResolvedValueOnce({ userId: null })

    await expect(Home()).rejects.toThrow('NEXT_REDIRECT:/sign-up')
    expect(redirectMock).toHaveBeenCalledWith('/sign-up')
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
})
