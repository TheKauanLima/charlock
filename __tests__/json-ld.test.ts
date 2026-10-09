import { describe, expect, it } from 'vitest'

import { serializeJsonLd } from '@/lib/json-ld'

describe('serializeJsonLd', () => {
  it('escapes < so a value cannot close the script element', () => {
    const output = serializeJsonLd({ name: '</script><script>alert(1)</script>' })

    expect(output).not.toContain('<')
    expect(output).toContain('\\u003c/script>')
  })

  it('round-trips through JSON.parse', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Cursed Concepts',
      description: 'a < b </script>',
      nested: [1, { ok: true }],
    }

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data)
  })
})
