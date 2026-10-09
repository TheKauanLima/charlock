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

  it('lists the SEO metadata routes as public', async () => {
    const { publicRoutes } = await import('../proxy')

    expect(publicRoutes).toEqual(expect.arrayContaining(['/robots.txt', '/sitemap.xml', '/opengraph-image(.*)']))
  })

  it.each(['/robots.txt', '/sitemap.xml', '/opengraph-image', '/opengraph-image/abc123'])(
    'does not protect %s',
    async pathname => {
      const { default: proxyHandler } = await import('../proxy')
      const protect = vi.fn<ProxyAuth['protect']>().mockResolvedValue(undefined)

      await (proxyHandler as unknown as ProxyHandler)(
        { protect },
        { nextUrl: new URL(`http://localhost${pathname}`) },
      )

      expect(protect).not.toHaveBeenCalled()
    },
  )

  it.each([
    '/profile',
    '/profile/',
    '/profile/settings',
    '/profile/settings/',
    '/profile/settings/x',
    '/profile/%73ettings',
    '/profile/a/b',
    '/profile/alice/extra',
    '/admin',
  ])('still protects %s', async pathname => {
    const { default: proxyHandler } = await import('../proxy')
    const protect = vi.fn<ProxyAuth['protect']>().mockResolvedValue(undefined)

    await (proxyHandler as unknown as ProxyHandler)(
      { protect },
      { nextUrl: new URL(`http://localhost${pathname}`) },
    )

    expect(protect).toHaveBeenCalledTimes(1)
  })

  it.each([
    '/profile/alice',
    '/profile/someuser',
    '/profile/someuser/',
    '/characters/foo',
    '/characters/foo/opengraph-image',
  ])('does not protect the public page %s for guests', async pathname => {
    const { default: proxyHandler } = await import('../proxy')
    const protect = vi.fn<ProxyAuth['protect']>().mockResolvedValue(undefined)

    await (proxyHandler as unknown as ProxyHandler)(
      { protect },
      { nextUrl: new URL(`http://localhost${pathname}`) },
    )

    expect(protect).not.toHaveBeenCalled()
  })
})

describe('isPublicProfilePath', () => {
  it.each([
    '/profile/alice',
    '/profile/alice/',
    '/profile/user_123',
    '/profile/al%20ice',
    '/profile/%C3%A9lodie',
    '/profile/settings-fan',
    '/profile/settingsx',
    '/profile/mysettings',
  ])('treats %s as a public profile path', async pathname => {
    const { isPublicProfilePath, PUBLIC_PROFILE_PATH_PATTERN } = await import('../proxy')

    expect(isPublicProfilePath(pathname)).toBe(true)
    expect(PUBLIC_PROFILE_PATH_PATTERN.test(pathname)).toBe(true)
  })

  it.each([
    '/profile',
    '/profile/',
    '/profile//',
    '/profile/settings',
    '/profile/settings/',
    '/profile/settings/x',
    '/profile/alice/extra',
    '/profile/alice//',
    '/profiles/alice',
    '/x/profile/alice',
    '/characters/foo',
  ])('does not treat %s as a public profile path', async pathname => {
    const { isPublicProfilePath } = await import('../proxy')

    expect(isPublicProfilePath(pathname)).toBe(false)
  })

  it.each(['/profile/%73ettings', '/profile/%73ettings/', '/profile/%E0%A4%A'])(
    'rejects the encoded or malformed segment %s',
    async pathname => {
      const { isPublicProfilePath } = await import('../proxy')

      expect(isPublicProfilePath(pathname)).toBe(false)
    },
  )
})
