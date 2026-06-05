import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendAuthEmailMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/resend', () => ({
  sendAuthEmail: sendAuthEmailMock,
}))

import { POST } from '@/app/api/auth/email/route'

beforeEach(() => {
  sendAuthEmailMock.mockReset()
})

describe('auth email route', () => {
  it('sends themed auth emails through Resend', async () => {
    sendAuthEmailMock.mockResolvedValueOnce({ data: { id: 'email_123' } })

    const response = await POST(
      new Request('http://localhost/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'player@example.com', type: 'verify_email' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(sendAuthEmailMock).toHaveBeenCalledWith('player@example.com', 'verify_email')
    await expect(response.json()).resolves.toEqual({ success: true })
  })

  it('rejects unsupported auth email requests', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'player@example.com', type: 'welcome' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(sendAuthEmailMock).not.toHaveBeenCalled()
  })
})
