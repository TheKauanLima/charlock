/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const dns = require('dns')
const path = require('path')
const mongoose = require('mongoose')

const HERO_INFO_THEMES = [
  { tagTexts: ['Pressure', 'Frontline', 'Burst'] },
  { tagTexts: ['Dive', 'Chase', 'Momentum'] },
  { tagTexts: ['Trap', 'Control', 'Zone'] },
  { tagTexts: ['Skirmish', 'Harass', 'Tempo'] },
  { tagTexts: ['Ambush', 'Burst', 'Execute'] },
  { tagTexts: ['Utility', 'Support', 'Reset'] },
]

const WEAPON_STAT_DEFINITIONS = [
  { label: 'Bullet Damage', valueField: 'bullet_damage', fallback: 0, unit: '', icon: 'bulletDamage', scalingBase: 'bullet_damage' },
  { label: 'Weapon Damage', valueField: 'weapon_damage_percent', fallback: 0, unit: '%', icon: 'bulletDamage', scalingBase: 'weapon_damage_percent' },
  { label: 'Bullets per sec', valueField: 'bullets_per_sec', fallback: 0, unit: '', icon: 'fireRate', scalingBase: 'bullets_per_sec' },
  { label: 'Fire Rate', valueField: 'fire_rate_percent', fallback: 0, unit: '%', icon: 'fireRate', scalingBase: 'fire_rate_percent' },
  { label: 'Ammo', valueField: 'ammo', fallback: 0, unit: '', icon: 'ammoClipSize', scalingBase: 'ammo' },
  { label: 'Clip Size Increase', valueField: 'clip_size_increase_percent', fallback: 0, unit: '%', icon: 'ammoClipSize', scalingBase: 'clip_size_increase_percent' },
  { label: 'Reload Time', valueField: 'reload_time', fallback: 0, unit: 's', icon: 'ammoReload', scalingBase: 'reload_time' },
  { label: 'Reload Reduction', valueField: 'reload_reduction_percent', fallback: 0, unit: '%', icon: 'ammoReloadReduction', scalingBase: 'reload_reduction_percent' },
  { label: 'Bullet Velocity', valueField: 'bullet_velocity', fallback: 0, unit: 'm/s', icon: 'bulletVelocity', scalingBase: 'bullet_velocity' },
  { label: 'Bullet Velocity Increase', valueField: 'bullet_velocity_increase_percent', fallback: 0, unit: '%', icon: 'bulletVelocity', scalingBase: 'bullet_velocity_increase_percent' },
  { label: 'Bullet Lifesteal', valueField: 'bullet_lifesteal_percent', fallback: 0, unit: '%', icon: 'healthStealBullets', scalingBase: 'bullet_lifesteal_percent' },
  { label: 'Crit Bonus Scale', valueField: 'crit_bonus_scale_percent', fallback: 0, unit: '%', icon: 'critBonusScale', scalingBase: 'crit_bonus_scale_percent' },
  { label: 'Light Melee', valueField: 'light_melee_damage', fallback: 50, unit: '', icon: 'melee', scalingBase: 'light_melee_damage' },
  { label: 'Heavy Melee', valueField: 'heavy_melee_damage', fallback: 116, unit: '', icon: 'melee', scalingBase: 'heavy_melee_damage' },
]

const VITALITY_STAT_DEFINITIONS = [
  { label: 'Max Health', valueField: 'max_health', fallback: 810, unit: '', icon: 'maxHealth', scalingBase: 'max_health' },
  { label: 'Health Regen', valueField: 'health_regen', fallback: 1.5, unit: '', icon: 'healthRegen', scalingBase: 'health_regen' },
  { label: 'Heal Amp', valueField: 'heal_amp_percent', fallback: 0, unit: '%', icon: 'healAmp', scalingBase: 'heal_amp_percent' },
  { label: 'Non-Combat Regen', valueField: 'non_combat_regen', fallback: 0, unit: '', icon: 'healthRegen', scalingBase: 'non_combat_regen' },
  { label: 'Bullet Resist', valueField: 'bullet_resist_percent', fallback: 0, unit: '%', icon: 'bulletResist', scalingBase: 'bullet_resist_percent' },
  { label: 'Spirit Resist', valueField: 'spirit_resist_percent', fallback: 0, unit: '%', icon: 'spiritResist', scalingBase: 'spirit_resist_percent' },
  { label: 'Melee Resist', valueField: 'melee_resist_percent', fallback: 0, unit: '%', icon: 'meleeResist', scalingBase: 'melee_resist_percent' },
  { label: 'Debuff Resist', valueField: 'debuff_resist_percent', fallback: 0, unit: '%', icon: 'debuffResist', scalingBase: 'debuff_resist_percent' },
  { label: 'Crit Reduction', valueField: 'crit_reduction_percent', fallback: 0, unit: '%', icon: 'critReduction', scalingBase: 'crit_reduction_percent' },
  { label: 'Move Speed', valueField: 'move_speed', fallback: 6.3, unit: 'm', icon: 'moveSpeed', scalingBase: 'move_speed' },
  { label: 'Sprint Speed', valueField: 'sprint_speed', fallback: 1.1, unit: 'm', icon: 'moveSprint', scalingBase: 'sprint_speed' },
  { label: 'Stamina Cooldown', valueField: 'stamina_cooldown', fallback: 4.5, unit: 's', icon: 'staminaRecovery', scalingBase: 'stamina_cooldown' },
  { label: 'Stamina Recovery', valueField: 'stamina_recovery_percent', fallback: 0, unit: '%', icon: 'staminaRecovery', scalingBase: 'stamina_recovery_percent' },
  { label: 'Stamina', valueField: 'stamina', fallback: 3, unit: '', icon: 'stamina', scalingBase: 'stamina' },
  { label: 'Dash Speed', valueField: 'dash_speed', fallback: 0, unit: 'm', icon: 'stamina', scalingBase: 'dash_speed' },
]

const TOP_SPIRIT_STAT_DEFINITIONS = [
  { label: 'Ability Cooldown', valueField: 'ability_cooldown_percent', fallback: 0, unit: '%', icon: 'abilityCooldown', scalingBase: 'ability_cooldown_percent' },
  { label: 'Ability Duration', valueField: 'ability_duration_percent', fallback: 0, unit: '%', icon: 'abilityDuration', scalingBase: 'ability_duration_percent' },
  { label: 'Ability Range', valueField: 'ability_range_percent', fallback: 0, unit: '%', icon: 'abilityRange', scalingBase: 'ability_range_percent' },
  { label: 'Spirit Lifesteal', valueField: 'spirit_lifesteal_percent', fallback: 0, unit: '%', icon: 'spiritLifesteal', scalingBase: 'spirit_lifesteal_percent' },
  { label: 'Max Charges Increase', valueField: 'max_charges_increase', fallback: 0, unit: '', icon: 'maxCharges', scalingBase: 'max_charges_increase' },
  { label: 'Charge Cooldown', valueField: 'charge_cooldown_percent', fallback: 0, unit: '%', icon: 'chargeCooldown', scalingBase: 'charge_cooldown_percent' },
]

const SPIRIT_POWER_DEFINITION = {
  label: 'Spirit Power',
  valueField: 'spirit_power',
  fallback: 0,
  unit: '',
  icon: 'spiritPower',
  scalingBase: 'spirit_power',
  description: 'Spirit Power increases the effectiveness of your Abilities and items.',
}

function readEnvLocal(pathFile = '.env.local') {
  if (!fs.existsSync(pathFile)) return {}

  const content = fs.readFileSync(pathFile, 'utf8')
  const out = {}

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)

    if (match) {
      out[match[1].trim()] = match[2].trim()
    }
  }

  return out
}

function parseSrvUri(uri) {
  const match = uri.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/?([^?]*)\??(.*)$/)

  if (!match) {
    throw new Error('Not a valid mongodb+srv URI')
  }

  return { user: match[1], pass: match[2], host: match[3], db: match[4], opts: match[5] }
}

async function resolveSrvHost(host) {
  const resolver = new dns.Resolver()
  resolver.setServers(['8.8.8.8'])

  return new Promise((resolve, reject) => {
    resolver.resolveSrv(`_mongodb._tcp.${host}`, (err, records) => {
      if (err) return reject(err)
      resolve(records)
    })
  })
}

function buildNonSrvUri(parsed, srvRecords) {
  const hosts = srvRecords.map(record => `${record.name}:${record.port}`).join(',')
  const auth = parsed.user ? `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}@` : ''
  const options = parsed.opts ? parsed.opts : ''
  const optionMap = {}

  if (options) {
    for (const part of options.split('&')) {
      const [key, value] = part.split('=')
      if (key) optionMap[key] = value === undefined ? '' : value
    }
  }

  const requiredOptions = { ssl: 'true', authSource: 'admin', retryWrites: 'true', w: 'majority' }
  for (const [key, value] of Object.entries(requiredOptions)) {
    if (!(key in optionMap)) optionMap[key] = value
  }

  const queryString = '?' + Object.entries(optionMap).map(([key, value]) => `${key}=${value}`).join('&')
  const dbPath = parsed.db ? `/${parsed.db}` : ''

  return `mongodb://${auth}${hosts}${dbPath}${queryString}`
}

async function obtainConnectionString() {
  const env = readEnvLocal('.env.local')
  const rawUri = process.env.MONGODB_URI || env.MONGODB_URI

  if (!rawUri) {
    throw new Error('MONGODB_URI not found in env or .env.local')
  }

  if (!rawUri.startsWith('mongodb+srv://')) {
    return rawUri
  }

  const parsed = parseSrvUri(rawUri)
  const srvRecords = await resolveSrvHost(parsed.host)

  return buildNonSrvUri(parsed, srvRecords)
}

function loadHeroSeeds() {
  const filePath = path.join(process.cwd(), 'lib', 'hero-data.ts')
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
  const startToken = 'const HERO_SEEDS: HeroSeed[] = ['
  const endToken = '\n]\n\n// Populate HERO_INFO_OVERRIDES'
  const startIndex = text.indexOf(startToken)
  const endIndex = text.indexOf(endToken)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Could not parse lib/hero-data.ts')
  }

  const arrayText = text.slice(startIndex + startToken.length, endIndex)

  return Function(`return ([${arrayText}])`)()
}

function hashHero(hero) {
  return Array.from(`${hero.slug}:${hero.assetSlug || hero.slug}:${hero.displayName}`).reduce((hash, char) => hash + char.charCodeAt(0), 0)
}

function roundStat(value, decimals = 1) {
  return Number(value.toFixed(decimals))
}

function buildHeroStatsSource(hero) {
  const hash = hashHero(hero)

  return {
    ability_cooldown_percent: hash % 18,
    ability_duration_percent: hash % 14,
    ability_range_percent: hash % 22,
    ammo: 8 + (hash % 9),
    bullet_damage: roundStat(3.2 + (hash % 55) / 10),
    bullet_lifesteal_percent: hash % 12,
    bullet_velocity: 520 + (hash % 180),
    bullets_per_sec: roundStat(1.4 + (hash % 28) / 20, 2),
    charge_cooldown_percent: hash % 16,
    clip_size_increase_percent: hash % 20,
    crit_bonus_scale_percent: hash % 18,
    crit_reduction_percent: hash % 10,
    dash_speed: roundStat(6 + (hash % 8) / 10),
    debuff_resist_percent: hash % 12,
    fire_rate_percent: hash % 26,
    heal_amp_percent: hash % 14,
    health_regen: roundStat(1 + (hash % 18) / 10),
    heavy_melee_damage: 108 + (hash % 24),
    light_melee_damage: 46 + (hash % 12),
    max_charges_increase: hash % 3,
    max_health: 760 + (hash % 170),
    melee_resist_percent: hash % 12,
    move_speed: roundStat(6 + (hash % 10) / 10),
    non_combat_regen: roundStat((hash % 12) / 10),
    reload_reduction_percent: hash % 18,
    reload_time: roundStat(0.28 + (hash % 13) / 100, 2),
    spirit_lifesteal_percent: hash % 12,
    spirit_power: 4 + (hash % 16),
    spirit_resist_percent: hash % 16,
    sprint_speed: roundStat(1 + (hash % 8) / 10),
    stamina: 3 + (hash % 3),
    stamina_cooldown: roundStat(4 + (hash % 10) / 10),
    stamina_recovery_percent: hash % 18,
    weapon_damage_percent: hash % 24,
    bullet_damage_spirit_scaling: hash % 2 === 0 ? 0.2 : 0,
    fire_rate_percent_weapon_scaling: hash % 3 === 0 ? 0.3 : 0,
    max_health_boon_scaling: hash % 4 === 0 ? 0.4 : 0,
    spirit_power_spirit_scaling: hash % 5 === 0 ? 0.5 : 0,
  }
}

function parseScalingValue(value) {
  if (value == null) return null

  const parsed = Number(String(value).trim())

  if (Number.isNaN(parsed) || parsed === 0) return null

  return parsed
}

function mapScaling(row, base) {
  const spirit = parseScalingValue(row[`${base}_spirit_scaling`])
  const weapon = parseScalingValue(row[`${base}_weapon_scaling`])
  const boon = parseScalingValue(row[`${base}_boon_scaling`])

  if (spirit !== null) return { scaling: 'spirit', scalingValue: String(spirit) }
  if (weapon !== null) return { scaling: 'courage', scalingValue: String(weapon) }
  if (boon !== null) return { scaling: 'boon', scalingValue: String(boon) }

  return { scaling: 'none', scalingValue: '0' }
}

function buildStat(definition, row) {
  return {
    label: definition.label,
    value: String(row[definition.valueField] ?? definition.fallback),
    unit: definition.unit,
    icon: definition.icon,
    description: definition.description,
    ...mapScaling(row, definition.scalingBase),
  }
}

function removeUndefinedValues(stat) {
  return Object.fromEntries(Object.entries(stat).filter(([, value]) => value !== undefined))
}

function buildStatsPayload(hero, heroIndex) {
  const statsSource = buildHeroStatsSource(hero)
  const bulletDamage = Number(statsSource.bullet_damage ?? 0)
  const bulletsPerSecond = Number(statsSource.bullets_per_sec ?? 0)
  const theme = HERO_INFO_THEMES[heroIndex % HERO_INFO_THEMES.length]

  return {
    weapon: {
      weaponName: `${hero.displayName} Weapon`,
      weaponDesc: `${hero.displayName} pressure profile generated from the seeded hero stat table.`,
      gunImageSrc: '/panorama/images/hud/abilities/weapon_damage_psd.png',
      weaponAttributes: [theme.tagTexts[0], theme.tagTexts[1]],
      bulletDPS: Math.round(bulletDamage * bulletsPerSecond),
      weaponMinRange: 12 + (Number(statsSource.ammo ?? 0) % 4),
      weaponMaxRange: 34 + (Number(statsSource.bullet_velocity ?? 0) % 18),
      stats: WEAPON_STAT_DEFINITIONS.map(definition => removeUndefinedValues(buildStat(definition, statsSource))),
    },
    vitality: {
      stats: VITALITY_STAT_DEFINITIONS.map(definition => removeUndefinedValues(buildStat(definition, statsSource))),
    },
    spirit: {
      topStats: TOP_SPIRIT_STAT_DEFINITIONS.map(definition => removeUndefinedValues(buildStat(definition, statsSource))),
      spiritPowerStat: removeUndefinedValues(buildStat(SPIRIT_POWER_DEFINITION, statsSource)),
    },
  }
}

async function run() {
  const connStr = await obtainConnectionString()
  await mongoose.connect(connStr, { bufferCommands: false })

  const heroes = mongoose.connection.collection('heroes')
  const weaponStats = mongoose.connection.collection('weaponstats')
  const vitalityStats = mongoose.connection.collection('vitalitystats')
  const spiritStats = mongoose.connection.collection('spiritstats')
  const heroSeeds = loadHeroSeeds()
  const createdByUserId = process.env.HERO_SEED_CREATED_BY_USER_ID || 'system'
  const now = new Date()

  for (let index = 0; index < heroSeeds.length; index += 1) {
    const hero = heroSeeds[index]
    const heroDoc = {
      name: hero.displayName,
      slug: hero.slug,
      portrait: hero.portrait,
      render: hero.render,
      createdByUserId,
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    }

    await heroes.updateOne(
      { slug: hero.slug },
      { $set: heroDoc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )

    const persistedHero = await heroes.findOne({ slug: hero.slug }, { projection: { _id: 1 } })

    if (!persistedHero) {
      throw new Error(`Failed to load seeded hero ${hero.slug}`)
    }

    const payload = buildStatsPayload(hero, index)

    await weaponStats.updateOne(
      { heroId: persistedHero._id },
      { $set: { ...payload.weapon, heroId: persistedHero._id, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )
    await vitalityStats.updateOne(
      { heroId: persistedHero._id },
      { $set: { ...payload.vitality, heroId: persistedHero._id, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )
    await spiritStats.updateOne(
      { heroId: persistedHero._id },
      { $set: { ...payload.spirit, heroId: persistedHero._id, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )
  }

  console.log(`Seeded Hero, WeaponStats, VitalityStats, and SpiritStats documents for ${heroSeeds.length} heroes`)

  await mongoose.disconnect()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
