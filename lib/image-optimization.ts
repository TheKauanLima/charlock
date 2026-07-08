const VERCEL_BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

export const IMAGE_BLUR_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxNiI+PHJlY3QgZmlsbD0iIzE2MTkxNyIgd2lkdGg9IjEwIiBoZWlnaHQ9IjE2Ii8+PC9zdmc+'

export function getThumbnailUrl(src: string, width: number, height: number) {
  if (!src || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return src

  try {
    const url = new URL(src)

    if (url.protocol !== 'https:' || !url.hostname.endsWith(VERCEL_BLOB_HOST_SUFFIX)) return src

    url.searchParams.set('w', String(width))
    url.searchParams.set('h', String(height))

    return url.toString()
  } catch {
    return src
  }
}
