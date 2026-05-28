import { Schema, models, model, type Model } from 'mongoose'

export interface IUser {
  clerkId: string
  email: string
  username: string | null
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      default: null,
    },
    firstName: {
      type: String,
      default: null,
    },
    lastName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

userSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: {
      username: { $type: 'string' },
    },
  },
)

const User: Model<IUser> = models.User || model<IUser>('User', userSchema)

export default User