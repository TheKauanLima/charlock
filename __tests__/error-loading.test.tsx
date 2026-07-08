// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HeroGrid from '@/components/HeroGrid/HeroGrid'
import { ConnectionStatus, SystemToast } from '@/components/system-feedback/SystemFeedback'
import ProfileUnavailable from '@/components/UserProfile/ProfileUnavailable'
import { buildDefaultAbilityStats } from '@/lib/ability-editor-types'
import { ApiRequestError, toApiErrorResponse } from '@/lib/api-errors'
import { getUserFacingSaveError, parseClientRequestError, readApiResponse } from '@/lib/client-errors'
import { buildEditorRecoverySnapshot, EDITOR_RECOVERY_STORAGE_KEY, readEditorRecovery, writeEditorRecovery } from '@/lib/editor-recovery'
import { HEROES } from '@/lib/hero-data'
import { buildHeroStatsSeed } from '@/lib/hero-stats-shared'
import { UPLOAD_POLICIES, validateUploadFiles } from '@/lib/upload-validation'

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imageProps = { ...props }
    delete imageProps.fill
    delete imageProps.priority
    delete (imageProps as Record<string, unknown>).preload
    return React.createElement('img', imageProps)
  },
}))

vi.mock('@/lib/uploadthing', () => ({
  UploadButton: ({ content }: { content?: { button?: (state: { ready: boolean; isUploading: boolean; uploadProgress: number; fileTypes: string[]; files: File[] }) => React.ReactNode } }) => (
    <button type="button">{content?.button?.({ ready: true, isUploading: false, uploadProgress: 0, fileTypes: ['image'], files: [] }) ?? 'Upload'}</button>
  ),
  UploadDropzone: () => null,
}))

beforeEach(() => {
  pushMock.mockReset()
  window.localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('error and loading states', () => {
  it('returns stable client-facing API error codes without stack data', async () => {
    const response = toApiErrorResponse(new ApiRequestError('Sign in required.', 401))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Sign in required.',
      code: 'AUTH_REQUIRED',
      retryable: false,
    })
  })

  it('handles HTML save failures and expired-session redirects without JSON parser errors', async () => {
    const htmlResponse = new Response('<!DOCTYPE html><title>Server Error</title>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
    const authRedirect = new Response('<!DOCTYPE html><title>Sign In</title>')

    Object.defineProperty(authRedirect, 'redirected', { value: true })
    Object.defineProperty(authRedirect, 'url', { value: 'https://cursedconcepts.xyz/sign-in' })

    const htmlPayload = await readApiResponse(htmlResponse)
    const htmlError = parseClientRequestError(htmlResponse, htmlPayload, 'The save service returned an invalid response.')

    expect(htmlPayload).toBeNull()
    expect(getUserFacingSaveError(htmlError.message, htmlError.code)).toBe('The server could not save your character. Your draft is safe; please retry.')
    expect(parseClientRequestError(authRedirect, null, 'Invalid response')).toMatchObject({
      code: 'AUTH_REQUIRED',
      isSessionExpired: true,
    })
  })

  it('writes and restores a complete versioned editor snapshot', () => {
    const hero = HEROES[0]
    const snapshot = buildEditorRecoverySnapshot({
      heroSlug: hero.slug,
      savedHeroId: null,
      heroInfo: { ...hero.heroInfo, nameType: 'text', nameValue: 'Recovered Hero' },
      background: '/recovered-background.png',
      renderSelection: { mode: 'custom', src: '/recovered-render.png' },
      heroName: 'Recovered Hero',
      portrait: '/recovered-portrait.png',
      allowCopies: true,
      stats: buildHeroStatsSeed(hero),
      abilityStats: buildDefaultAbilityStats(hero),
      savedAt: '2026-06-29T12:00:00.000Z',
    })

    writeEditorRecovery(snapshot)

    expect(readEditorRecovery(window.localStorage, new Date('2026-06-30T12:00:00.000Z').getTime())).toMatchObject({
      heroName: 'Recovered Hero',
      portrait: '/recovered-portrait.png',
      allowCopies: true,
    })
    expect(window.localStorage.getItem(EDITOR_RECOVERY_STORAGE_KEY)).toContain('Recovered Hero')
  })

  it('rejects oversized and unsupported upload files before transfer', () => {
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'portrait.png', { type: 'image/png' })
    const invalidType = new File(['character'], 'character.txt', { type: 'text/plain' })

    expect(validateUploadFiles([oversized], UPLOAD_POLICIES.heroPortrait)).toEqual({
      valid: false,
      message: 'Asset payload exceeds 4MB limit.',
    })
    expect(validateUploadFiles([invalidType], UPLOAD_POLICIES.heroPortrait)).toMatchObject({
      valid: false,
      message: expect.stringContaining('Asset type is not supported'),
    })
  })

  it('shows a connection warning when the browser goes offline', async () => {
    render(<ConnectionStatus />)
    expect(screen.queryByText(/connection offline/i)).not.toBeInTheDocument()

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Draft changes remain stored locally')
  })

  it('portals temporary system notices to the viewport and dismisses them', async () => {
    vi.useFakeTimers()

    try {
      render(<SystemToast message="Template loaded." durationMs={1000} />)

      const toast = screen.getByRole('status')

      expect(toast).toHaveTextContent('Template loaded.')
      expect(toast.parentElement).toBe(document.body)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves a draft and offers retry when the save session expires', async () => {
    const user = userEvent.setup()
    const hero = HEROES[0]
    writeEditorRecovery(buildEditorRecoverySnapshot({
      heroSlug: hero.slug,
      savedHeroId: null,
      heroInfo: {
        ...hero.heroInfo,
        ability1Icon: '',
        ability2Icon: '',
        ability3Icon: '',
        ability4Icon: '',
      },
      background: hero.render,
      renderSelection: { mode: 'background', src: null },
      heroName: 'Offline Arc',
      portrait: hero.portrait,
      allowCopies: false,
      stats: buildHeroStatsSeed(hero),
      abilityStats: buildDefaultAbilityStats(hero),
    }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      error: 'Session token expired.',
      code: 'AUTH_REQUIRED',
      retryable: false,
    }, { status: 401 }))

    render(<HeroGrid initialTab="Create" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Name this save')).toHaveValue('Offline Arc'))
    await user.click(screen.getByRole('button', { name: 'Save Private' }))

    expect(await screen.findByRole('dialog', { name: 'SESSION CONNECTION TERMINATED' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Save rejected by server node')
    const submittedPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { heroInfo: { ability1Icon: string; ability2Icon: string; ability3Icon: string; ability4Icon: string } }
    expect([
      submittedPayload.heroInfo.ability1Icon,
      submittedPayload.heroInfo.ability2Icon,
      submittedPayload.heroInfo.ability3Icon,
      submittedPayload.heroInfo.ability4Icon,
    ]).not.toContain('')
    await waitFor(() => expect(window.localStorage.getItem(EDITOR_RECOVERY_STORAGE_KEY)).toContain('Offline Arc'))

    await user.click(screen.getByRole('button', { name: 'Retry Save' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('searches for another creator from an unavailable profile', async () => {
    const user = userEvent.setup()

    render(<ProfileUnavailable reason="private" />)
    expect(screen.getByText('This creator has limited profile access.')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Find another creator' }), 'arc light')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(pushMock).toHaveBeenCalledWith('/profile/arc%20light')
  })
})
