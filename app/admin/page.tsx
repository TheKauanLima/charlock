import AdminModerationDashboard from '@/components/Moderation/AdminModerationDashboard'
import { checkAdmin } from '@/lib/admin-guard'
import { listModerationQueue } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  await checkAdmin()
  const queue = await listModerationQueue()

  return <AdminModerationDashboard initialQueue={queue} />
}
