import { Schema, model, models, type Model, type Types } from 'mongoose'

import { statSchema, type IPanelStat } from './WeaponStats'

export interface IAbilityGridCell extends IPanelStat {
  id: string
}

export interface IAbilitySection {
  id: string
  type: 'richText' | 'grid'
  title: string
  text?: string
  mainCells?: IAbilityGridCell[]
  lowerCells?: IAbilityGridCell[]
}

export interface IAbilityDefinition {
  slot: number
  name: string
  icon: string
  cooldown: IPanelStat
  hasCharges: boolean
  charges: IPanelStat
  rechargeTime: IPanelStat
  subStats: IPanelStat[]
  sections: IAbilitySection[]
}

export interface IAbilityStats {
  heroId: Types.ObjectId
  abilities: IAbilityDefinition[]
  createdAt: Date
  updatedAt: Date
}

const abilityGridCellSchema = new Schema<IAbilityGridCell>({
  id: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: String, required: true },
  unit: { type: String, default: '' },
  append: { type: String, default: '' },
  icon: { type: String, default: '/panorama/images/icons/properties/spirit.svg' },
  iconColor: { type: String, default: '' },
  scaling: {
    type: String,
    enum: ['none', 'spirit', 'courage', 'melee', 'boon'],
    default: 'none',
  },
  scalingValue: { type: String, default: '0' },
  description: { type: String },
})

const abilitySectionSchema = new Schema<IAbilitySection>({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['richText', 'grid'],
    required: true,
  },
  title: { type: String, required: true },
  text: { type: String, default: '' },
  mainCells: {
    type: [abilityGridCellSchema],
    validate: {
      validator(cells: IAbilityGridCell[]) {
        return cells.length <= 3
      },
      message: 'Grid sections support up to 3 main cells.',
    },
  },
  lowerCells: [abilityGridCellSchema],
})

const abilityDefinitionSchema = new Schema<IAbilityDefinition>({
  slot: { type: Number, required: true, min: 1 },
  name: { type: String, required: true },
  icon: { type: String, required: true },
  cooldown: {
    type: statSchema,
    required: true,
  },
  hasCharges: { type: Boolean, default: false },
  charges: {
    type: statSchema,
    required: true,
  },
  rechargeTime: {
    type: statSchema,
    required: true,
  },
  subStats: [statSchema],
  sections: [abilitySectionSchema],
})

const abilityStatsSchema = new Schema<IAbilityStats>(
  {
    heroId: {
      type: Schema.Types.ObjectId,
      ref: 'Hero',
      required: true,
      unique: true,
      index: true,
    },
    abilities: {
      type: [abilityDefinitionSchema],
      required: true,
      validate: {
        validator(abilities: IAbilityDefinition[]) {
          return abilities.length >= 4
        },
        message: 'AbilityStats must include at least 4 abilities.',
      },
    },
  },
  {
    timestamps: true,
  },
)

const AbilityStats: Model<IAbilityStats> = models.AbilityStats || model<IAbilityStats>('AbilityStats', abilityStatsSchema)

export default AbilityStats
