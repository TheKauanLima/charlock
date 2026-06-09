import { CustomHeroError } from '@/lib/custom-heroes'
import { getActivityFeed } from '@/lib/social-engagement'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Activity feed request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function GET() {
  try {
    const items = await getActivityFeed()

    return Response.json({ items })
  } catch (error) {
    return toErrorResponse(error)
  }
}
