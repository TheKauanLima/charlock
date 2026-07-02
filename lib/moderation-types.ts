export const REPORT_REASONS = [
  'Inappropriate Language / Toxic',
  'Plagiarism',
  'Spam / Irrelevant',
  'NSFW Assets',
] as const

export type ReportReason = typeof REPORT_REASONS[number]
export type ModerationStatus = 'clean' | 'flagged' | 'hidden'
export type ModerationContentType = 'hero' | 'comment'
export type ModerationAction = 'approve' | 'delete' | 'suspend'

export interface ContentReport {
  reporterId: string
  reason: ReportReason
  details?: string
  createdAt: Date
}

export interface SerializedContentReport extends Omit<ContentReport, 'createdAt'> {
  createdAt: string
}

export interface ModerationQueueItem {
  id: string
  type: ModerationContentType
  title: string
  content?: string
  thumbnail?: string
  authorId: string
  moderationStatus: ModerationStatus
  reportCount: number
  reasonCounts: Partial<Record<ReportReason, number>>
  reports: SerializedContentReport[]
}

export interface ModerationQueue {
  heroes: ModerationQueueItem[]
  comments: ModerationQueueItem[]
}
