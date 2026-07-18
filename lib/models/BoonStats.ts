import { Schema, model, models, type Model, type Types } from 'mongoose'

import type { IPanelStat } from './WeaponStats'

export interface IBoonStats {
  heroId: Types.ObjectId
  name?: string
  stats: IPanelStat[]
  panels?: IBoonPanelVariant[]
  createdAt: Date
  updatedAt: Date
}

export interface IBoonPanelVariant {
  id: string
  name: string
  stats: IPanelStat[]
}

const boonStatSchema = new Schema<IPanelStat>({
  label: { type: String, required: true },
  value: { type: String, required: true },
  unit: { type: String, default: '' },
  icon: { type: String, default: 'dot' },
  iconColor: { type: String, default: '' },
  scaling: { type: String, enum: ['boon'], default: 'boon' },
  scalingValue: { type: String, required: true },
}, { _id: false })

const boonPanelVariantSchema = new Schema<IBoonPanelVariant>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  stats: { type: [boonStatSchema], default: [] },
}, { _id: false })

const boonStatsSchema = new Schema<IBoonStats>({
  heroId: {
    type: Schema.Types.ObjectId,
    ref: 'Hero',
    required: true,
    unique: true,
    index: true,
  },
  name: { type: String, default: 'Boon Rewards' },
  stats: {
    type: [boonStatSchema],
    default: [],
  },
  panels: { type: [boonPanelVariantSchema], default: undefined },
}, { timestamps: true })

const BoonStats: Model<IBoonStats> = models.BoonStats || model<IBoonStats>('BoonStats', boonStatsSchema)

export default BoonStats
