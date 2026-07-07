import { z } from 'zod'

const scalingSchema = z.enum(['none', 'spirit', 'courage', 'melee', 'boon'])
const stringOrNumberSchema = z.union([z.string(), z.number()])

export function stripDatabaseMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDatabaseMetadata)
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '_id' && key !== '__v')
      .map(([key, nestedValue]) => [key, stripDatabaseMetadata(nestedValue)]),
  )
}

export const panelStatSchema = z.object({
  label: z.string().max(120).optional(),
  value: stringOrNumberSchema.optional(),
  unit: z.string().max(40).optional(),
  append: z.string().max(40).optional(),
  icon: z.string().max(500).optional(),
  iconColor: z.string().max(80).optional(),
  scaling: scalingSchema.optional(),
  scalingValue: stringOrNumberSchema.optional(),
  description: z.string().max(1000).optional(),
}).strict()

const namedPanelSchema = {
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(80),
}

const weaponPanelVariantSchema = z.object({
  ...namedPanelSchema,
  bulletDPS: z.number().optional(),
  weaponMinRange: z.number().optional(),
  weaponMaxRange: z.number().optional(),
  stats: z.array(panelStatSchema).max(40),
}).strict()

const vitalityPanelVariantSchema = z.object({
  ...namedPanelSchema,
  stats: z.array(panelStatSchema).max(40),
}).strict()

const spiritPanelVariantSchema = z.object({
  ...namedPanelSchema,
  topStats: z.array(panelStatSchema).max(40),
  spiritPowerStat: panelStatSchema,
}).strict()

const abilityRichTextSectionSchema = z.object({
  id: z.string().max(160).optional(),
  type: z.literal('richText'),
  title: z.string().max(120).optional(),
  text: z.string().max(5000).optional(),
}).strict()

const abilityGridCellSchema = panelStatSchema.extend({
  id: z.string().max(160).optional(),
}).strict()

const abilityGridSectionSchema = z.object({
  id: z.string().max(160).optional(),
  type: z.literal('grid'),
  title: z.string().max(120).optional(),
  mainCells: z.array(abilityGridCellSchema).max(12).optional(),
  lowerCells: z.array(abilityGridCellSchema).max(24).optional(),
}).strict()

const abilitySectionSchema = z.discriminatedUnion('type', [
  abilityRichTextSectionSchema,
  abilityGridSectionSchema,
])

const abilityVariantSchema = z.object({
  name: z.string().max(120).optional(),
  icon: z.string().max(500).optional(),
  cooldown: panelStatSchema.optional(),
  hasCooldown: z.boolean().optional(),
  hasCharges: z.boolean().optional(),
  charges: panelStatSchema.optional(),
  rechargeTime: panelStatSchema.optional(),
  subStats: z.array(panelStatSchema).max(24).optional(),
  sections: z.array(abilitySectionSchema).max(12).optional(),
}).strict()

const abilityTierSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  upgradeText: z.string().max(2000).optional(),
  variant: abilityVariantSchema.optional(),
}).strict()

const abilityDefinitionSchema = abilityVariantSchema.extend({
  slot: z.number().int().min(1).max(4).optional(),
  tiers: z.array(abilityTierSchema).max(3).optional(),
}).strict()

export const heroInfoSchema = z.object({
  nameType: z.enum(['text', 'image']).optional(),
  nameValue: z.string().max(500).optional(),
  nameColor: z.string().max(80).optional(),
  nameFontSize: z.string().max(80).optional(),
  nameFontFamily: z.string().max(160).optional(),
  nameFontWeight: z.string().max(80).optional(),
  tag1Text: z.string().max(80).optional(),
  tag2Text: z.string().max(80).optional(),
  tag3Text: z.string().max(80).optional(),
  tagColor: z.string().max(80).optional(),
  tagTextColor: z.string().max(80).optional(),
  tag1Tilt: z.number().optional(),
  tag2Tilt: z.number().optional(),
  tag3Tilt: z.number().optional(),
  tag1OffsetY: z.number().optional(),
  tag2OffsetY: z.number().optional(),
  tag3OffsetY: z.number().optional(),
  ability1Icon: z.string().max(500).optional(),
  ability2Icon: z.string().max(500).optional(),
  ability3Icon: z.string().max(500).optional(),
  ability4Icon: z.string().max(500).optional(),
  abilityCircleColor: z.string().max(80).optional(),
  abilityIconColor: z.string().max(80).optional(),
  backstory: z.string().max(10000).optional(),
}).strict()

export const customHeroSaveSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().trim().min(1, 'Hero name is required').max(120),
  status: z.enum(['private', 'published']).default('private'),
  hero: z.object({
    portrait: z.string().max(500).optional(),
    render: z.string().max(500),
    background: z.string().max(500).optional(),
  }).strict(),
  allowCopies: z.boolean().default(false),
  heroInfo: heroInfoSchema.default({}),
  weapon: z.object({
    weaponName: z.string().max(120).optional(),
    weaponDesc: z.string().max(3000).optional(),
    gunImageSrc: z.string().max(500).optional(),
    weaponAttributes: z.array(z.string().max(80)).max(20).optional(),
    bulletDPS: z.number().optional(),
    weaponMinRange: z.number().optional(),
    weaponMaxRange: z.number().optional(),
    stats: z.array(panelStatSchema).max(40).optional(),
    panels: z.array(weaponPanelVariantSchema).max(8).optional(),
  }).strict().default({}),
  vitality: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    stats: z.array(panelStatSchema).max(40).optional(),
    panels: z.array(vitalityPanelVariantSchema).max(8).optional(),
  }).strict().default({}),
  spirit: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    topStats: z.array(panelStatSchema).max(40).optional(),
    spiritPowerStat: panelStatSchema.optional(),
    panels: z.array(spiritPanelVariantSchema).max(8).optional(),
  }).strict().default({}),
  abilityStats: z.object({
    abilities: z.array(abilityDefinitionSchema).max(4).optional(),
    secondaryAbilities: z.array(abilityDefinitionSchema).max(4).optional(),
    secondaryAbilitySlots: z.array(z.number().int().min(0).max(3)).max(4).optional(),
    secondaryAbilityAnchorIndex: z.number().int().min(0).max(3).optional(),
  }).strict().default({}),
}).strict()

export const authEmailRequestSchema = z.object({
  email: z.email('A valid email address is required'),
  type: z.enum(['verify_email', 'reset_password'], {
    error: 'Unsupported auth email type',
  }),
}).strict()

export const heroCommentRequestSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required').max(500, 'Comments cannot exceed 500 characters'),
}).strict()
