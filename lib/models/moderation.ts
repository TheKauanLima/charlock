import { Schema } from 'mongoose'

import { REPORT_REASONS } from '@/lib/moderation-types'
import type { ContentReport } from '@/lib/moderation-types'

export const contentReportSchema = new Schema<ContentReport>(
  {
    reporterId: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: REPORT_REASONS,
    },
    details: {
      type: String,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
)
