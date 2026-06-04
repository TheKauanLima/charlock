const fs = require('fs')
const path = require('path')
const dns = require('dns')
const mongoose = require('mongoose')

function readEnvLocal(pathFile = '.env.local') {
  if (!fs.existsSync(pathFile)) return {}
  const content = fs.readFileSync(pathFile, 'utf8')
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

function parseSrvUri(uri) {
  const m = uri.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/?([^?]*)\??(.*)$/)
  if (!m) throw new Error('Not a valid mongodb+srv URI')
  return { user: m[1], pass: m[2], host: m[3], db: m[4], opts: m[5] }
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
  const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',')
  const auth = parsed.user ? `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}@` : ''
  const opts = parsed.opts ? parsed.opts : ''
  const map = {}
  if (opts) for (const part of opts.split('&')) { const [k,v]=part.split('='); if (k) map[k]=v===undefined?'':v }
  const requiredMap = { ssl: 'true', authSource: 'admin', retryWrites: 'true', w: 'majority' }
  for (const [k,v] of Object.entries(requiredMap)) if (!(k in map)) map[k]=v
  const qs = '?' + Object.entries(map).map(([k,v])=>`${k}=${v}`).join('&')
  const dbPath = parsed.db ? `/${parsed.db}` : ''
  return `mongodb://${auth}${hosts}${dbPath}${qs}`
}

async function obtainConnectionString() {
  const env = readEnvLocal('.env.local')
  const raw = process.env.MONGODB_URI || env.MONGODB_URI
  if (!raw) throw new Error('MONGODB_URI not found in env or .env.local')
  if (!raw.startsWith('mongodb+srv://')) return raw
  const parsed = parseSrvUri(raw)
  const srv = await resolveSrvHost(parsed.host)
  return buildNonSrvUri(parsed, srv)
}

function normalizeName(s) {
  return s.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

async function run() {
  const connStr = await obtainConnectionString()
  await mongoose.connect(connStr, { bufferCommands: false })

  const collection = mongoose.connection.collection('heroinfos')

  const heroNamesDir = path.join(process.cwd(), 'public', 'panorama', 'images', 'heroes', 'hero_names')
  const files = fs.existsSync(heroNamesDir) ? fs.readdirSync(heroNamesDir).filter(f => f.endsWith('.svg')) : []
  const normalizedMap = {}
  for (const f of files) normalizedMap[normalizeName(f.replace(/\.svg$/i, ''))] = f

  // Load alias resolver mapping if available to improve matching
  const aliasResolverPath = path.join(process.cwd(), '.agents', 'skills', 'deadmock-hero-aliases', 'scripts', 'resolve_alias.cjs')
  let aliases = {}
  if (fs.existsSync(aliasResolverPath)) {
    const text = fs.readFileSync(aliasResolverPath, 'utf8')
    const m = text.match(/const aliases = \{([\s\S]*?)\};/)
    if (m) {
      const objText = '{' + m[1] + '}'
      try {
        // naive eval in Function to parse object literal
        aliases = Function('return ' + objText)()
      } catch (e) {
        console.warn('Failed to parse aliases file:', e.message)
      }
    }
  }

  const reverseAliases = {}
  for (const [a, v] of Object.entries(aliases)) {
    const key = String(v).toLowerCase()
    reverseAliases[key] = reverseAliases[key] || []
    reverseAliases[key].push(a.toLowerCase())
  }

  const cursor = collection.find()
  let updated = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    const nameValue = doc.nameValue || ''
    const basename = path.basename(nameValue || '').replace(/\.svg$/i, '')
    if (basename && files.includes(basename + '.svg')) continue

    // try to find best match
    const candidates = Object.keys(normalizedMap)
    const target = normalizeName(basename || doc._id.toString())
    let best = null
    for (const c of candidates) {
      if (c.includes(target) || target.includes(c)) { best = normalizedMap[c]; break }
    }

    if (!best) {
      // fallback: exact substring match of any token
      for (const c of candidates) {
        if (c.startsWith(target.slice(0,4)) || target.startsWith(c.slice(0,4))) { best = normalizedMap[c]; break }
      }
    }

    if (!best && basename) {
      const aliasLower = basename.toLowerCase()
      // case-insensitive key lookup in aliases
      let foundKey = null
      for (const k of Object.keys(aliases)) if (k.toLowerCase() === aliasLower) { foundKey = k; break }

      if (foundKey) {
        const canonical = String(aliases[foundKey]).toLowerCase()
        if (normalizedMap[canonical]) best = normalizedMap[canonical]
        if (!best && reverseAliases[canonical]) {
          for (const a of reverseAliases[canonical]) if (normalizedMap[a]) { best = normalizedMap[a]; break }
        }
      }

      // also try reverseAliases by treating basename as canonical directly
      if (!best) {
        const canonicalLower = aliasLower
        if (reverseAliases[canonicalLower]) {
          for (const a of reverseAliases[canonicalLower]) if (normalizedMap[a]) { best = normalizedMap[a]; break }
        }
      }
    }

    if (best) {
      const newNameValue = `/panorama/images/heroes/hero_names/${best}`
      await collection.updateOne({ _id: doc._id }, { $set: { nameValue: newNameValue, updatedAt: new Date() } })
      console.log(`Updated doc ${doc._id} nameValue -> ${newNameValue}`)
      updated++
    } else {
      console.log(`No candidate for doc ${doc._id} (current: ${nameValue})`)
    }
  }

  console.log('Signature fixes complete. Documents updated:', updated)
  await mongoose.disconnect()
}

run().catch(err => { console.error('Failed:', err); process.exit(1) })
