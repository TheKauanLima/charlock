import type { NextRequest } from 'next/server'

import { listNotifications, getNotificationState } from '@/lib/notifications'
import type { NotificationType } from '@/lib/models/Notification'

function getNotificationType(value: string | null): NotificationType | undefined {
  return value === 'comment' || value === 'like' || value === 'follow' || value === 'publish' ? value : undefined
}

export async function GET(request: NextRequest) {
  try {
    const hasListFilters = request.nextUrl.searchParams.has('type') || request.nextUrl.searchParams.has('unreadOnly') || request.nextUrl.searchParams.has('limit')
    const notifications = hasListFilters
      ? await listNotifications({
          unreadOnly: request.nextUrl.searchParams.get('unreadOnly') === 'true',
          type: getNotificationType(request.nextUrl.searchParams.get('type')),
          limit: Math.min(Number(request.nextUrl.searchParams.get('limit')) || 40, 80),
        })
      : await getNotificationState()

    return Response.json({ notifications })
  } catch {
    return Response.json({ notifications: { hasNotifications: false, count: 0, items: [] } })
  }
}
