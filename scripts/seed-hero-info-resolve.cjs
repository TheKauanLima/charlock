const fs = require('fs')
const dns = require('dns')
const mongoose = require('mongoose')

function readEnvLocal(path = '.env.local') {
  if (!fs.existsSync(path)) return {}
  const content = fs.readFileSync(path, 'utf8')
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

function parseSrvUri(uri) {
  // mongodb+srv://user:pass@host/db?opts
  const m = uri.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/?([^?]*)\??(.*)$/)
  if (!m) throw new Error('Not a valid mongodb+srv URI')
  return { user: m[1], pass: m[2], host: m[3], db: m[4], opts: m[5] }
}

async function resolveSrv(host) {
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
  // srvRecords: [{ name, port }]
  const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',')
  const auth = parsed.user ? `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}@` : ''
  // parse existing options and merge required ones without duplication
  const opts = parsed.opts ? parsed.opts : ''
  const map = {}
  if (opts) {
    for (const part of opts.split('&')) {
      const [k, v] = part.split('=')
      if (k) map[k] = v === undefined ? '' : v
    }
  }

  const requiredMap = { ssl: 'true', authSource: 'admin', retryWrites: 'true', w: 'majority' }
  for (const [k, v] of Object.entries(requiredMap)) {
    if (!(k in map)) map[k] = v
  }

  const qs = '?' + Object.entries(map).map(([k, v]) => `${k}=${v}`).join('&')
  const dbPath = parsed.db ? `/${parsed.db}` : ''
  return `mongodb://${auth}${hosts}${dbPath}${qs}`
}

async function main() {
  const env = readEnvLocal('.env.local')
  const uri = process.env.MONGODB_URI || env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not found in env or .env.local')
    process.exit(1)
  }

  if (!uri.startsWith('mongodb+srv://')) {
    console.log('MONGODB_URI is not an SRV URI; using directly')
    await mongoose.connect(uri, { bufferCommands: false })
    console.log('Connected')
    await mongoose.disconnect()
    return
  }

  const parsed = parseSrvUri(uri)
  console.log('Resolved SRV host:', parsed.host)

  const srv = await resolveSrv(parsed.host)
  console.log('SRV records (via 8.8.8.8):', srv.map(r => `${r.name}:${r.port}`).join(', '))

  const nonSrv = buildNonSrvUri(parsed, srv)
  console.log('Attempting non-SRV connection string (hidden credentials)')
  // Use the non-SRV URI for the rest of the process (seed script expects MONGODB_URI)
  process.env.MONGODB_URI = nonSrv

  // quick connection test
  await mongoose.connect(nonSrv, { bufferCommands: false })
  console.log('Connected via non-SRV hosts')
  await mongoose.disconnect()

  // Hand off to the CommonJS seeder which reads process.env.MONGODB_URI
  console.log('Running scripts/seed-hero-info.cjs to persist HeroInfo documents')
  require('./seed-hero-info.cjs')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
