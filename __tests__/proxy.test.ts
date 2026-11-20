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

// Byte-exact copy of the Clerk matcher. In the source it is written as a
// normal string with a double backslash before the dot, so the runtime value
// contains one backslash (an escaped regex dot). Losing it makes any path that
// contains js, ico, css, ... skip clerkMiddleware, and auth() then throws.
const EXPECTED_PAGE_MATCHER = String.raw`/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|otf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)`

describe('proxy matcher', () => {
  it('keeps the escaped dot in the page matcher', async () => {
    const { config } = await import('../proxy')

    expect(config.matcher[0]).toBe(EXPECTED_PAGE_MATCHER)
    expect(config.matcher[0]).toContain('[^?]*' + String.fromCharCode(92) + '.(?:')
  })

  it.each(['/characters/nicolas-hero', '/profile/jsmith', '/characters/css-hero/opengraph-image', '/api/icons'])(
    'runs the middleware on %s',
    async pathname => {
      const { config } = await import('../proxy')

      expect(new RegExp(`^${config.matcher[0]}$`).test(pathname)).toBe(true)
    },
  )

  it.each(['/foo.js', '/x.png', '/favicon.ico', '/styles/site.css'])('skips static asset %s', async pathname => {
    const { config } = await import('../proxy')

    expect(new RegExp(`^${config.matcher[0]}$`).test(pathname)).toBe(false)
  })
})

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
