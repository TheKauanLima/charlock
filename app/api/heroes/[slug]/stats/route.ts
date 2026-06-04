import { getHeroStatsBySlug } from '@/lib/hero-stats'

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params

  try {
    const stats = await getHeroStatsBySlug(slug)

    if (!stats) {
      return Response.json({ error: 'Hero stats not found' }, { status: 404 })
    }

    return Response.json(stats)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch hero stats'

    return Response.json({ error: message }, { status: 500 })
  }
}
