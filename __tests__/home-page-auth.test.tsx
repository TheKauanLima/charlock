// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/components/HeroGrid/HeroGrid', () => ({
  default: () => <div data-testid="hero-grid" />,
}))

import Home from '@/app/page'

beforeEach(() => {
  authMock.mockReset()
  redirectMock.mockClear()
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
})
