import { Schema, model, models, type Model } from 'mongoose'

export interface IHero {
  name: string
  slug: string
  assetSlug: string
  portrait: string
  render: string
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
    assetSlug: {
      type: String,
      required: true,
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
  },
  {
    collection: 'heroes',
    timestamps: true,
  },
)

heroSchema.index({ name: 'text' })

const Hero: Model<IHero> = models.Hero || model<IHero>('Hero', heroSchema)

export default Hero
