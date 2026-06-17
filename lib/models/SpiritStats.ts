import { Schema, model, models, type Model, type Types } from 'mongoose'
import { statSchema, type IPanelStat } from './WeaponStats'

export interface ISpiritStats {
  heroId: Types.ObjectId
  topStats: IPanelStat[]
  spiritPowerStat: IPanelStat
  createdAt: Date
  updatedAt: Date
}

const spiritStatsSchema = new Schema<ISpiritStats>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    topStats: [statSchema],
    spiritPowerStat: {
      type: statSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

const SpiritStats: Model<ISpiritStats> = models.SpiritStats || model<ISpiritStats>('SpiritStats', spiritStatsSchema)

export default SpiritStats
