import { Schema, model, models, type Model, type Types } from 'mongoose'
import { statSchema, type IPanelStat } from './WeaponStats'

export interface IVitalityStats {
  heroId: Types.ObjectId
  name?: string
  stats: IPanelStat[]
  panels?: IVitalityPanelVariant[]
  createdAt: Date
  updatedAt: Date
}

export interface IVitalityPanelVariant {
  id: string
  name: string
  stats: IPanelStat[]
}

const vitalityPanelVariantSchema = new Schema<IVitalityPanelVariant>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  stats: [statSchema],
}, { _id: false })

const vitalityStatsSchema = new Schema<IVitalityStats>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true, maxlength: 80 },
    stats: [statSchema],
    panels: { type: [vitalityPanelVariantSchema], default: undefined },
  },
  {
    timestamps: true,
  },
)

const VitalityStats: Model<IVitalityStats> = models.VitalityStats || model<IVitalityStats>('VitalityStats', vitalityStatsSchema)

export default VitalityStats
