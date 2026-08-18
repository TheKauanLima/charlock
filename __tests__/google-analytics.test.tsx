import type { ScriptHTMLAttributes } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GoogleAnalytics from '@/components/google-analytics/GoogleAnalytics'
import { getGoogleAnalyticsMeasurementId } from '@/lib/google-analytics'

vi.mock('next/script', () => ({
  default: ({ strategy, ...props }: ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => (
    <script data-strategy={strategy} {...props} />
  ),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Google Analytics', () => {
  it('uses the Charlock GA4 measurement ID by default', () => {
    expect(getGoogleAnalyticsMeasurementId({})).toBe('G-DLK5L73G1T')
  })

  it('accepts a valid environment override and rejects unsafe values', () => {
    expect(getGoogleAnalyticsMeasurementId({
      NEXT_PUBLIC_GA_MEASUREMENT_ID: ' g-override123 ',
    })).toBe('G-OVERRIDE123')
    expect(getGoogleAnalyticsMeasurementId({
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-INVALID';alert(1)",
    })).toBe('G-DLK5L73G1T')
  })

  it('loads gtag after hydration on production deployments', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')

    const { container } = render(<GoogleAnalytics />)
    const scripts = container.querySelectorAll('script')

    expect(scripts).toHaveLength(2)
    expect(scripts[0]).toHaveAttribute(
      'src',
      'https://www.googletagmanager.com/gtag/js?id=G-DLK5L73G1T',
    )
    expect(scripts[0]).toHaveAttribute('data-strategy', 'afterInteractive')
    expect(scripts[1]).toHaveAttribute('id', 'google-analytics')
    expect(scripts[1].textContent).toContain("gtag('config', \"G-DLK5L73G1T\")")
  })

  it('does not track local development or Vercel previews', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const developmentRender = render(<GoogleAnalytics />)

    expect(developmentRender.container).toBeEmptyDOMElement()
    developmentRender.unmount()

    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const previewRender = render(<GoogleAnalytics />)

    expect(previewRender.container).toBeEmptyDOMElement()
  })
})
