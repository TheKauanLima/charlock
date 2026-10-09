/** Serializes JSON-LD for a native <script type="application/ld+json">; escapes `<` as `\u003c`. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
