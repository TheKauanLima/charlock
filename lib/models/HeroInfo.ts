import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface IHeroInfo {
  heroId: Types.ObjectId
  createdByUserId?: string | null
  nameType: 'image' | 'text'
  nameValue: string
  nameColor: string
  nameFontSize?: string
  nameFontFamily?: string
  nameFontWeight?: string
  tag1Text: string
  tag2Text: string
  tag3Text: string
  tagColor: string
  tagTextColor: string
  tag1Tilt: number
  tag2Tilt: number
  tag3Tilt: number
  tag1OffsetY: number
  tag2OffsetY: number
  tag3OffsetY: number
  ability1Icon: string
  ability2Icon: string
  ability3Icon: string
  ability4Icon: string
  abilityCircleColor: string
  abilityIconColor: string
  backstory?: string
  createdAt: Date
  updatedAt: Date
}

const heroInfoSchema = new Schema<IHeroInfo>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    createdByUserId: {
      type: String,
      default: null,
      index: true,
    },
    nameType: {
      type: String,
      required: true,
      enum: ['image', 'text'],
    },
    nameValue: {
      type: String,
      required: true,
    },
    nameColor: {
      type: String,
      required: true,
    },
    nameFontSize: {
      type: String,
    },
    nameFontFamily: {
      type: String,
    },
    nameFontWeight: {
      type: String,
    },
    tag1Text: {
      type: String,
      required: true,
    },
    tag2Text: {
      type: String,
      required: true,
    },
    tag3Text: {
      type: String,
      required: true,
    },
    tagColor: {
      type: String,
      required: true,
    },
    tagTextColor: {
      type: String,
      required: true,
    },
    tag1Tilt: {
      type: Number,
      required: true,
    },
    tag2Tilt: {
      type: Number,
      required: true,
    },
    tag3Tilt: {
      type: Number,
      required: true,
    },
    tag1OffsetY: {
      type: Number,
      required: true,
    },
    tag2OffsetY: {
      type: Number,
      required: true,
    },
    tag3OffsetY: {
      type: Number,
      required: true,
    },
    ability1Icon: {
      type: String,
    },
    ability2Icon: {
      type: String,
    },
    ability3Icon: {
      type: String,
    },
    ability4Icon: {
      type: String,
    },
    abilityCircleColor: {
      type: String,
      required: true,
    },
    abilityIconColor: {
      type: String,
      required: true,
    },
    backstory: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

heroInfoSchema.index({ backstory: 'text' })

const HeroInfo: Model<IHeroInfo> = models.HeroInfo || model<IHeroInfo>('HeroInfo', heroInfoSchema)

export default HeroInfo
