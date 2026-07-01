'use client'

import { useEffect } from 'react'

import { RouteError } from '@/components/system-feedback/SystemFeedback'

export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => console.error(error), [error])

  return <RouteError title="Application link interrupted" message="An unexpected system fault stopped this view from loading." errorId={error.digest} onRetry={unstable_retry} />
}
