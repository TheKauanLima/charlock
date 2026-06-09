import { CustomHeroError, recordCustomHeroCopy } from '@/lib/custom-heroes'

function toErrorResponse(error: unknown) {
  if (error instanceof CustomHeroError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Hero copy request failed'

  return Response.json({ error: message }, { status: 500 })
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    await recordCustomHeroCopy(slug)

    return Response.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
