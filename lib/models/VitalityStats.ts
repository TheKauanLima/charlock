import { Schema, model, models, type Model, type Types } from 'mongoose'
import { statSchema, type IPanelStat } from './WeaponStats'

export interface IVitalityStats {
  heroId: Types.ObjectId
  stats: IPanelStat[]
  createdAt: Date
  updatedAt: Date
}

const vitalityStatsSchema = new Schema<IVitalityStats>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    stats: [statSchema],
  },
  {
    timestamps: true,
  },
)

const VitalityStats: Model<IVitalityStats> = models.VitalityStats || model<IVitalityStats>('VitalityStats', vitalityStatsSchema)

export default VitalityStats
