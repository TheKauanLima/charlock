import { Schema, models, model, type Model } from 'mongoose'

export interface IUser {
  clerkId: string
  email: string
  username: string | null
  emailVerified: boolean
  firstName: string | null
  lastName: string | null
  preferredHero: string
  isPublic: boolean
  anonymousEdits: boolean
  customBio?: string | null
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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      default: null,
    },
    lastName: {
      type: String,
      default: null,
    },
    preferredHero: {
      type: String,
      default: 'abrams',
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    anonymousEdits: {
      type: Boolean,
      default: false,
    },
    customBio: {
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
