import { CustomHeroError } from '@/lib/custom-heroes'
import { toggleHeroBookmark } from '@/lib/social-engagement'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Bookmark request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const bookmark = await toggleHeroBookmark(slug)

    return Response.json({ bookmark })
  } catch (error) {
    return toErrorResponse(error)
  }
}
