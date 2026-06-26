import { Schema, model, models, type Model, type Types } from 'mongoose'

export type NotificationType = 'like' | 'comment' | 'follow' | 'publish'

export interface INotification {
  recipientId: string
  actorId: string
  type: NotificationType
  targetId: Types.ObjectId
  relatedHeroId?: Types.ObjectId
  read: boolean
  createdAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'publish'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    relatedHeroId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomHero',
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

notificationSchema.index({ recipientId: 1, createdAt: -1 })
notificationSchema.index({ recipientId: 1, actorId: 1, type: 1, targetId: 1 }, { unique: true })

const Notification: Model<INotification> = models.Notification || model<INotification>('Notification', notificationSchema)

export default Notification
