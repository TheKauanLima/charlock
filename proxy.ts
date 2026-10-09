import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

export const publicRoutes = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  '/forgot-password(.*)',
  '/characters(.*)',
  '/api/auth/email(.*)',
  '/api/uploadthing(.*)',
  '/api/webhooks/clerk(.*)',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image(.*)',
]

/**
 * Public creator profiles: exactly one segment under `/profile`, excluding
 * `settings`. `/profile`, `/profile/settings(/...)` and deeper paths stay protected.
 * Server actions POSTed to `/profile/<username>` authenticate themselves
 * (`getCurrentProfileUser()` in `lib/profile.ts`).
 */
export const PUBLIC_PROFILE_PATH_PATTERN = /^\/profile\/(?!settings(?:\/|$))[^/]+\/?$/

export function isPublicProfilePath(pathname: string): boolean {
  if (!PUBLIC_PROFILE_PATH_PATTERN.test(pathname)) {
    return false
  }

  // Also reject a percent-encoded `settings` segment (e.g. `/profile/%73ettings`)
  // and segments that cannot be decoded.
  const segment = pathname.slice('/profile/'.length).replace(/\/$/, '')

  try {
    return decodeURIComponent(segment) !== 'settings'
  } catch {
    return false
  }
}

const isPublicRoute = createRouteMatcher(publicRoutes)

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req) || isPublicProfilePath(req.nextUrl.pathname)) {
    return
  }

  await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|otf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)',
    '/(api|trpc)(.*)',
  ],
}
