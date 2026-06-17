import { Schema, model, models, type Model } from 'mongoose'

export interface IFollow {
  followerId: string
  followingId: string
  createdAt: Date
  updatedAt: Date
}

const followSchema = new Schema<IFollow>(
  {
    followerId: {
      type: String,
      required: true,
      index: true,
    },
    followingId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true })

const Follow: Model<IFollow> = models.Follow || model<IFollow>('Follow', followSchema)

export default Follow
