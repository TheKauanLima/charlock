import { Schema, model, models, type Model, type Types } from 'mongoose'

import type { IPanelStat } from './WeaponStats'

export interface IBoonStats {
  heroId: Types.ObjectId
  stats: IPanelStat[]
  createdAt: Date
  updatedAt: Date
}

const boonStatsSchema = new Schema<IBoonStats>({
  heroId: {
    type: Schema.Types.ObjectId,
    ref: 'Hero',
    required: true,
    unique: true,
    index: true,
  },
  stats: {
    type: [new Schema<IPanelStat>({
      label: { type: String, required: true },
      value: { type: String, required: true },
      unit: { type: String, default: '' },
      icon: { type: String, default: 'dot' },
      scaling: { type: String, enum: ['boon'], default: 'boon' },
      scalingValue: { type: String, required: true },
    }, { _id: false })],
    default: [],
  },
}, { timestamps: true })

const BoonStats: Model<IBoonStats> = models.BoonStats || model<IBoonStats>('BoonStats', boonStatsSchema)

export default BoonStats
