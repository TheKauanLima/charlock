import { Schema, model, models, type Model, type Types } from 'mongoose'

import { statSchema, type IPanelStat } from './WeaponStats'

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
  stats: { type: [statSchema], default: [] },
}, { timestamps: true })

const BoonStats: Model<IBoonStats> = models.BoonStats || model<IBoonStats>('BoonStats', boonStatsSchema)

export default BoonStats
