import { CustomHeroError } from '@/lib/custom-heroes'
import { toggleFollow } from '@/lib/social-engagement'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Follow request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const follow = await toggleFollow(id)

    return Response.json({ follow })
  } catch (error) {
    return toErrorResponse(error)
  }
}
