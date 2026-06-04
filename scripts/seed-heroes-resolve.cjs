const fs = require('fs')
const dns = require('dns')
const mongoose = require('mongoose')

function readEnvLocal(pathFile = '.env.local') {
  if (!fs.existsSync(pathFile)) return {}
  const content = fs.readFileSync(pathFile, 'utf8')
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)
    if (match) out[match[1].trim()] = match[2].trim()
  }
  return out
}

function parseSrvUri(uri) {
  const match = uri.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/?([^?]*)\??(.*)$/)
  if (!match) throw new Error('Not a valid mongodb+srv URI')
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
  for (const [key, value] of Object.entries(requiredOptions)) if (!(key in optionMap)) optionMap[key] = value
  const queryString = '?' + Object.entries(optionMap).map(([key, value]) => `${key}=${value}`).join('&')
  const dbPath = parsed.db ? `/${parsed.db}` : ''
  return `mongodb://${auth}${hosts}${dbPath}${queryString}`
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

  const srv = await resolveSrvHost(parsed.host)
  console.log('SRV records (via 8.8.8.8):', srv.map(record => `${record.name}:${record.port}`).join(', '))

  const nonSrv = buildNonSrvUri(parsed, srv)
  console.log('Attempting non-SRV connection string (hidden credentials)')
  process.env.MONGODB_URI = nonSrv

  await mongoose.connect(nonSrv, { bufferCommands: false })
  console.log('Connected via non-SRV hosts')
  await mongoose.disconnect()

  console.log('Running scripts/seed-heroes.cjs to persist Hero documents')
  require('./seed-heroes.cjs')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})