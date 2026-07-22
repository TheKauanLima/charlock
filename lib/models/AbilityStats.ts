import { Schema, model, models, type Model, type Types } from 'mongoose'

import { customScalingSchema, statSchema, type IPanelStat } from './WeaponStats'

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

export interface IAbilityVariant {
  name: string
  icon: string
  cooldown: IPanelStat
  hasCooldown: boolean
  hasCharges: boolean
  charges: IPanelStat
  rechargeTime: IPanelStat
  subStats: IPanelStat[]
  sections: IAbilitySection[]
}

export interface IAbilityTier {
  tier: 1 | 2 | 3
  upgradeText: string
  variant: IAbilityVariant
}

export interface IAbilityDefinition extends IAbilityVariant {
  slot: number
  tiers: IAbilityTier[]
}

export interface IAbilityStats {
  heroId: Types.ObjectId
  abilities: IAbilityDefinition[]
  secondaryAbilities?: IAbilityDefinition[]
  secondaryAbilitySlots?: number[]
  secondaryAbilityAnchorIndex?: number
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
    enum: ['none', 'spirit', 'courage', 'melee', 'boon', 'custom'],
    default: 'none',
  },
  scalingValue: { type: String, default: '0' },
  customScaling: { type: customScalingSchema, default: undefined },
  description: { type: String },
}, { _id: false })

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
}, { _id: false })

const abilityVariantSchema = new Schema<IAbilityVariant>({
  name: { type: String, required: true },
  icon: { type: String, required: true },
  cooldown: {
    type: statSchema,
    required: true,
  },
  hasCooldown: { type: Boolean, default: true },
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
}, { _id: false })

const abilityTierSchema = new Schema<IAbilityTier>({
  tier: {
    type: Number,
    enum: [1, 2, 3],
    required: true,
  },
  upgradeText: { type: String, default: '' },
  variant: {
    type: abilityVariantSchema,
    required: true,
  },
}, { _id: false })

const abilityDefinitionSchema = new Schema<IAbilityDefinition>({
  slot: { type: Number, required: true, min: 1 },
  name: { type: String, required: true },
  icon: { type: String, required: true },
  cooldown: {
    type: statSchema,
    required: true,
  },
  hasCooldown: { type: Boolean, default: true },
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
  tiers: {
    type: [abilityTierSchema],
    validate: {
      validator(tiers: IAbilityTier[]) {
        return tiers.length === 3
      },
      message: 'Ability definitions must include exactly 3 upgrade tiers.',
    },
  },
}, { _id: false })

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
    secondaryAbilities: {
      type: [abilityDefinitionSchema],
      default: undefined,
      validate: {
        validator(abilities: IAbilityDefinition[]) {
          return !abilities || abilities.length <= 4
        },
        message: 'Secondary ability sets support up to 4 abilities.',
      },
    },
    secondaryAbilitySlots: {
      type: [Number],
      default: undefined,
      validate: {
        validator(slots: number[]) {
          return !slots || (slots.length <= 4 && slots.every(slot => Number.isInteger(slot) && slot >= 0 && slot <= 3) && new Set(slots).size === slots.length)
        },
        message: 'Secondary ability slots must be unique ability indexes from 0 to 3.',
      },
    },
    secondaryAbilityAnchorIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
)

const AbilityStats: Model<IAbilityStats> = models.AbilityStats || model<IAbilityStats>('AbilityStats', abilityStatsSchema)

export default AbilityStats
