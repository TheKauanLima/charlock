import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface ILike {
  heroId: Types.ObjectId
  userId: string
  createdAt: Date
}

const likeSchema = new Schema<ILike>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomHero',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

likeSchema.index({ heroId: 1, userId: 1 }, { unique: true })
likeSchema.index({ userId: 1, createdAt: -1 })

const Like: Model<ILike> = models.Like || model<ILike>('Like', likeSchema)

export default Like
