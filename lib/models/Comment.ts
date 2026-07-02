import { Schema, model, models, type Model, type Types } from 'mongoose'

import type { ContentReport, ModerationStatus } from '@/lib/moderation-types'
import { contentReportSchema } from '@/lib/models/moderation'

export interface IComment {
  heroId: Types.ObjectId
  userId: string
  content: string
  reports: ContentReport[]
  moderationStatus: ModerationStatus
  createdAt: Date
  updatedAt: Date
}

const commentSchema = new Schema<IComment>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    reports: {
      type: [contentReportSchema],
      default: [],
    },
    moderationStatus: {
      type: String,
      enum: ['clean', 'flagged', 'hidden'],
      default: 'clean',
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

commentSchema.index({ heroId: 1, createdAt: -1 })

const Comment: Model<IComment> = models.Comment || model<IComment>('Comment', commentSchema)

export default Comment
