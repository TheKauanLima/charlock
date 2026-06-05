import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface IPanelStat {
  label: string
  value: string
  unit: string
  icon: string
  scaling: 'none' | 'spirit' | 'courage' | 'melee' | 'boon'
  scalingValue: string
  description?: string
}

export interface IWeaponStats {
  heroId: Types.ObjectId
  weaponName: string
  weaponDesc: string
  gunImageSrc: string
  weaponAttributes: string[]
  bulletDPS: number
  weaponMinRange: number
  weaponMaxRange: number
  stats: IPanelStat[]
  createdAt: Date
  updatedAt: Date
}

export const statSchema = new Schema<IPanelStat>({
  label: { type: String, required: true },
  value: { type: String, required: true },
  unit: { type: String, default: '' },
  icon: { type: String, default: 'dot' },
  scaling: {
    type: String,
    enum: ['none', 'spirit', 'courage', 'melee', 'boon'],
    default: 'none',
  },
  scalingValue: { type: String, default: '0' },
  description: { type: String },
})

const weaponStatsSchema = new Schema<IWeaponStats>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    weaponName: { type: String, required: true },
    weaponDesc: { type: String, default: '' },
    gunImageSrc: { type: String, default: '' },
    weaponAttributes: [{ type: String }],
    bulletDPS: { type: Number, default: 0 },
    weaponMinRange: { type: Number, default: 0 },
    weaponMaxRange: { type: Number, default: 0 },
    stats: [statSchema],
  },
  {
    timestamps: true,
  },
)

const WeaponStats: Model<IWeaponStats> = models.WeaponStats || model<IWeaponStats>('WeaponStats', weaponStatsSchema)

export default WeaponStats
