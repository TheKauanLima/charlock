import { Schema, model, models, type Model } from 'mongoose'

export interface IHero {
  name: string
  slug: string
  portrait: string
  render: string
  createdByUserId: string
  status: 'published' | 'private'
  publishedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const heroSchema = new Schema<IHero>(
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
    createdByUserId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['published', 'private'],
      default: 'private',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

const Hero: Model<IHero> = models.Hero || model<IHero>('Hero', heroSchema)

export default Hero