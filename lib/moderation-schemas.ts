import { z } from 'zod'

import { REPORT_REASONS } from '@/lib/moderation-types'

export const contentReportRequestSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
}).strict()

export const moderationResolveRequestSchema = z.object({
  type: z.enum(['hero', 'comment']),
  id: z.string().trim().min(1),
  action: z.enum(['approve', 'delete', 'suspend']),
}).strict()

export type ContentReportRequest = z.infer<typeof contentReportRequestSchema>
export type ModerationResolveRequest = z.infer<typeof moderationResolveRequestSchema>
