import type { Metadata } from 'next'

import AdminModerationDashboard from '@/components/Moderation/AdminModerationDashboard'
import { checkAdmin } from '@/lib/admin-guard'
import { listModerationQueue } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  await checkAdmin()
  const queue = await listModerationQueue()

  return <AdminModerationDashboard initialQueue={queue} />
}
