'use client'

import { useEffect } from 'react'

import { RouteError } from '@/components/system-feedback/SystemFeedback'

export default function ProfileError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => console.error(error), [error])

  return <RouteError title="Profile link interrupted" message="The profile service did not complete its response." errorId={error.digest} onRetry={unstable_retry} />
}
