import { getNotificationState } from '@/lib/social-engagement'

export async function GET() {
  try {
    const notifications = await getNotificationState()

    return Response.json({ notifications })
  } catch {
    return Response.json({ notifications: { hasNotifications: false, count: 0 } })
  }
}
