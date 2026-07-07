import { Schema, model, models, type Model, type Types } from 'mongoose'
import { statSchema, type IPanelStat } from './WeaponStats'

export interface ISpiritStats {
  heroId: Types.ObjectId
  name?: string
  topStats: IPanelStat[]
  spiritPowerStat: IPanelStat
  panels?: ISpiritPanelVariant[]
  createdAt: Date
  updatedAt: Date
}

export interface ISpiritPanelVariant {
  id: string
  name: string
  topStats: IPanelStat[]
  spiritPowerStat: IPanelStat
}

const spiritPanelVariantSchema = new Schema<ISpiritPanelVariant>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  topStats: [statSchema],
  spiritPowerStat: { type: statSchema, required: true },
}, { _id: false })

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
    name: { type: String, trim: true, maxlength: 80 },
    panels: { type: [spiritPanelVariantSchema], default: undefined },
  },
  {
    timestamps: true,
  },
)

const SpiritStats: Model<ISpiritStats> = models.SpiritStats || model<ISpiritStats>('SpiritStats', spiritStatsSchema)

export default SpiritStats
