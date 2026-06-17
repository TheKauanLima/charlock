import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendAuthEmailMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/resend', () => ({
  sendAuthEmail: sendAuthEmailMock,
}))

import { POST } from '@/app/api/auth/email/route'
import { resetRateLimitStore } from '@/lib/rate-limit'

beforeEach(() => {
  sendAuthEmailMock.mockReset()
  resetRateLimitStore()
})

function buildAuthEmailRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request('http://localhost/api/auth/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('auth email route', () => {
  it('sends themed auth emails through Resend', async () => {
    sendAuthEmailMock.mockResolvedValueOnce({ data: { id: 'email_123' } })

    const response = await POST(buildAuthEmailRequest({ email: 'player@example.com', type: 'verify_email' }))

    expect(response.status).toBe(200)
    expect(sendAuthEmailMock).toHaveBeenCalledWith('player@example.com', 'verify_email')
    await expect(response.json()).resolves.toEqual({ success: true })
  })

  it('rejects unsupported auth email requests', async () => {
    const response = await POST(buildAuthEmailRequest({ email: 'player@example.com', type: 'welcome' }))

    expect(response.status).toBe(400)
    expect(sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('requires same-origin JSON requests', async () => {
    const response = await POST(buildAuthEmailRequest(
      { email: 'player@example.com', type: 'verify_email' },
      { Origin: 'https://evil.example' },
    ))

    expect(response.status).toBe(403)
    expect(sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('rate-limits repeated auth email requests by IP', async () => {
    sendAuthEmailMock.mockResolvedValue({ data: { id: 'email_123' } })

    for (let index = 0; index < 5; index += 1) {
      const response = await POST(buildAuthEmailRequest(
        { email: 'player@example.com', type: 'verify_email' },
        { 'x-forwarded-for': '203.0.113.10' },
      ))

      expect(response.status).toBe(200)
    }

    const blockedResponse = await POST(buildAuthEmailRequest(
      { email: 'player@example.com', type: 'verify_email' },
      { 'x-forwarded-for': '203.0.113.10' },
    ))

    expect(blockedResponse.status).toBe(429)
    expect(sendAuthEmailMock).toHaveBeenCalledTimes(5)
  })
})
