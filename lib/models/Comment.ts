import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface IComment {
  heroId: Types.ObjectId
  userId: string
  content: string
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
  },
  {
    timestamps: true,
  },
)

commentSchema.index({ heroId: 1, createdAt: -1 })

const Comment: Model<IComment> = models.Comment || model<IComment>('Comment', commentSchema)

export default Comment
