import { Schema, model, models, type Model } from 'mongoose'

import type { ContentReport, ModerationStatus } from '@/lib/moderation-types'
import { contentReportSchema } from '@/lib/models/moderation'

export interface ICustomHeroEngagementEvent {
  userId: string
  createdAt: Date
}

export interface ICustomHero {
  name: string
  slug: string
  portrait: string
  render: string
  background: string
  createdByUserId: string
  status: 'published' | 'private'
  likesCount: number
  likedBy: string[]
  likeEvents: ICustomHeroEngagementEvent[]
  copyEvents: ICustomHeroEngagementEvent[]
  allowCopies: boolean
  publishedAt?: Date | null
  reports: ContentReport[]
  moderationStatus: ModerationStatus
  createdAt: Date
  updatedAt: Date
}

const customHeroEngagementEventSchema = new Schema<ICustomHeroEngagementEvent>(
  {
    userId: {
      type: String,
      required: true,
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

const customHeroSchema = new Schema<ICustomHero>(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    portrait: {
      type: String,
      required: true,
    },
    render: {
      type: String,
      required: true,
    },
    background: {
      type: String,
      default: '',
    },
    createdByUserId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['private', 'published'],
      default: 'private',
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    likedBy: {
      type: [String],
      default: [],
    },
    likeEvents: {
      type: [customHeroEngagementEventSchema],
      default: [],
    },
    copyEvents: {
      type: [customHeroEngagementEventSchema],
      default: [],
    },
    allowCopies: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
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
    collection: 'customheroes',
    timestamps: true,
  },
)

customHeroSchema.index({ name: 'text' })
customHeroSchema.index({ 'likeEvents.createdAt': -1 })
customHeroSchema.index({ 'copyEvents.createdAt': -1 })

const CustomHero: Model<ICustomHero> = models.CustomHero || model<ICustomHero>('CustomHero', customHeroSchema)

export default CustomHero
