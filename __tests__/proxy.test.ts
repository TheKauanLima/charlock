import { describe, expect, it, vi } from 'vitest'

const clerkServerMocks = vi.hoisted(() => ({
  clerkMiddleware: vi.fn((handler: ProxyHandler) => handler),
  createRouteMatcher: vi.fn((routes: string[]) => {
    return (request: ProxyRequest) => {
      const pathname = request.nextUrl.pathname

      return routes.some(route => {
        const baseRoute = route.replace('(.*)', '')

        return pathname === baseRoute || pathname.startsWith(`${baseRoute}/`)
      })
    }
  }),
}))

interface ProxyAuth {
  protect: () => Promise<void>
}

interface ProxyRequest {
  nextUrl: URL
}

type ProxyHandler = (auth: ProxyAuth, request: ProxyRequest) => Promise<void>

vi.mock('@clerk/nextjs/server', () => clerkServerMocks)

describe('auth proxy', () => {
  it('allows the Clerk OAuth callback to complete before protecting signed-out routes', async () => {
    const { default: proxyHandler, publicRoutes } = await import('../proxy')
    const protect = vi.fn<ProxyAuth['protect']>().mockResolvedValue(undefined)

    expect(publicRoutes).toContain('/sso-callback(.*)')

    await (proxyHandler as unknown as ProxyHandler)(
      { protect },
      { nextUrl: new URL('http://localhost/sso-callback') },
    )

    expect(protect).not.toHaveBeenCalled()

    await (proxyHandler as unknown as ProxyHandler)(
      { protect },
      { nextUrl: new URL('http://localhost/profile') },
    )

    expect(protect).toHaveBeenCalledTimes(1)
  })
})
