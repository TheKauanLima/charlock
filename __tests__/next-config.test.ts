// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import nextConfig from '@/next.config'

interface PicomatchOptions {
  dot?: boolean
  contains?: boolean
}

type Picomatch = (glob: string | string[], options?: PicomatchOptions) => (value: string) => boolean

// The same picomatch build Next uses to apply outputFileTracingExcludes.
const picomatch = createRequire(import.meta.url)('next/dist/compiled/picomatch') as Picomatch

const OG_ROUTES = ['/characters/[slug]/opengraph-image', '/opengraph-image']

function getExcludesForRoute(route: string): string[] {
  const excludes = nextConfig.outputFileTracingExcludes ?? {}

  // Same matching Next uses in collect-build-traces: picomatch, dot + contains.
  return Object.entries(excludes)
    .filter(([glob]) => picomatch(glob, { dot: true, contains: true })(route))
    .flatMap(([, patterns]) => patterns)
}

describe('next.config outputFileTracingExcludes', () => {
  it.each(OG_ROUTES)('excludes public/ from the %s trace', route => {
    const excludes = getExcludesForRoute(route)
    const isExcluded = picomatch(excludes.map(pattern => pattern.replace(/^\.\//, '')), { dot: true })

    expect(excludes.length).toBeGreaterThan(0)
    expect(isExcluded('public/landing/banner.png')).toBe(true)
    expect(isExcluded('public/heroes/deep/nested/art.webp')).toBe(true)
    expect(isExcluded('node_modules/next/dist/server/next-server.js')).toBe(false)
  })

  it('keeps hero OG images off the filesystem so the exclude is safe', () => {
    const source = readFileSync(join(process.cwd(), 'lib/public-pages.ts'), 'utf8')

    expect(source).not.toMatch(/node:fs|from 'fs'|process\.cwd\(\)|realpath/)
  })
})
