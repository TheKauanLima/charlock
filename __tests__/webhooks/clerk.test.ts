import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
  deleteOneMock: vi.fn(),
  updateUserMock: vi.fn(),
  dbConnectMock: vi.fn(),
  headersMock: vi.fn(),
  clerkClientMock: vi.fn(),
}))

vi.mock('svix', () => ({
  Webhook: class {
    verify = mocks.verifyMock
  },
}))

vi.mock('next/headers', () => ({
  headers: mocks.headersMock,
}))

vi.mock('@/lib/dbConnect', () => ({
  default: mocks.dbConnectMock,
}))

vi.mock('@/lib/models/User', () => ({
  default: {
    findOneAndUpdate: mocks.findOneAndUpdateMock,
    deleteOne: mocks.deleteOneMock,
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: mocks.clerkClientMock,
}))

async function importRoute() {
  return import('@/app/api/webhooks/clerk/route')
}

function buildRequest() {
  return new Request('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SECRET = 'whsec_test'

  mocks.verifyMock.mockReset()
  mocks.findOneAndUpdateMock.mockReset()
  mocks.deleteOneMock.mockReset()
  mocks.updateUserMock.mockReset()
  mocks.dbConnectMock.mockReset()
  mocks.headersMock.mockReset()
  mocks.clerkClientMock.mockReset()

  mocks.headersMock.mockResolvedValue(
    new Headers({
      'svix-id': 'msg_123',
      'svix-timestamp': '1710000000',
      'svix-signature': 'valid-signature',
    }),
  )

  mocks.dbConnectMock.mockResolvedValue(undefined)
  mocks.updateUserMock.mockResolvedValue(undefined)
  mocks.clerkClientMock.mockResolvedValue({
    users: {
      updateUser: mocks.updateUserMock,
    },
  })
})

describe('Clerk webhook route', () => {
  it('upserts user records and syncs Mongo metadata for valid create events', async () => {
    mocks.verifyMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_123',
        email_addresses: [{ email_address: 'test@example.com', id: 'email_1', verification: { status: 'verified' } }],
        primary_email_address_id: 'email_1',
        username: 'tester',
        first_name: 'Test',
        last_name: 'User',
      },
    })

    mocks.findOneAndUpdateMock.mockResolvedValue({
      _id: 'mongo_123',
    })

    const { POST } = await importRoute()
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mocks.dbConnectMock).toHaveBeenCalledTimes(1)
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      { clerkId: 'clerk_123' },
      {
        clerkId: 'clerk_123',
        email: 'test@example.com',
        username: 'tester',
        emailVerified: true,
        firstName: 'Test',
        lastName: 'User',
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
    expect(mocks.updateUserMock).toHaveBeenCalledWith('clerk_123', {
      publicMetadata: {
        mongo_user_id: 'mongo_123',
      },
    })
    expect(await response.json()).toEqual({ success: true })
  })

  it('returns 400 for invalid Svix signatures', async () => {
    mocks.verifyMock.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const { POST } = await importRoute()
    const response = await POST(buildRequest())

    expect(response.status).toBe(400)
    expect(mocks.dbConnectMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ error: 'Invalid signature' })
  })

  it('deletes users for user.deleted events', async () => {
    mocks.verifyMock.mockReturnValue({
      type: 'user.deleted',
      data: {
        id: 'clerk_999',
      },
    })

    const { POST } = await importRoute()
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mocks.deleteOneMock).toHaveBeenCalledWith({ clerkId: 'clerk_999' })
    expect(await response.json()).toEqual({ success: true })
  })

  it('uses unsafe metadata username when Clerk username is disabled', async () => {
    mocks.verifyMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_meta',
        email_addresses: [{ email_address: 'meta@example.com', id: 'email_meta', verification: { status: 'verified' } }],
        primary_email_address_id: 'email_meta',
        username: null,
        unsafe_metadata: {
          username: 'metadata_user',
        },
      },
    })

    mocks.findOneAndUpdateMock.mockResolvedValue({
      _id: 'mongo_meta',
    })

    const { POST } = await importRoute()
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      { clerkId: 'clerk_meta' },
      expect.objectContaining({
        username: 'metadata_user',
      }),
      expect.any(Object),
    )
  })
})
