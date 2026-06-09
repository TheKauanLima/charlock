import { CustomHeroError, likeCustomHero } from '@/lib/custom-heroes'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Hero like request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const hero = await likeCustomHero(slug)

    return Response.json({ hero })
  } catch (error) {
    return toErrorResponse(error)
  }
}
