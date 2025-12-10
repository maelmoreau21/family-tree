import express from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import multer from 'multer'
import { randomUUID, createHash } from 'node:crypto'

import {
  initialiseDatabase,
  getTreePayload,
  setTreePayload,
  getLastUpdatedAt,
  rebuildFts,
  rebuildFts,
  getDatabaseUrl,
  getTreeSubset
} from './db.js'
import { importGedcomStream } from './gedcom-stream.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT_DIR, 'dist')
const STATIC_DIR = path.resolve(ROOT_DIR, 'static')
const DOCUMENT_DIR = path.resolve(ROOT_DIR, 'document')

const TREE_DATA_DIR = path.resolve(process.env.TREE_DATA_DIR || path.join(ROOT_DIR, 'data'))
const TREE_BACKUP_DIR = path.resolve(process.env.TREE_BACKUP_DIR || path.join(TREE_DATA_DIR, 'backups'))
const TREE_BACKUP_LIMIT = Math.max(0, Number.parseInt(process.env.TREE_BACKUP_LIMIT || '50', 10))
const VIEWER_PORT = Number.parseInt(process.env.VIEWER_PORT || '7920', 10)
const BUILDER_PORT = Number.parseInt(process.env.BUILDER_PORT || '7921', 10)
const DEFAULT_MAX_UPLOAD_MB = Math.max(1, Number.parseInt(process.env.TREE_MAX_UPLOAD_MB || '5', 10))
const MAX_UPLOAD_SIZE = process.env.TREE_MAX_UPLOAD_SIZE
  ? Math.max(1024, Number.parseInt(process.env.TREE_MAX_UPLOAD_SIZE, 10))
  : DEFAULT_MAX_UPLOAD_MB * 1024 * 1024
const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
const TREE_PAYLOAD_LIMIT = process.env.TREE_PAYLOAD_LIMIT || '25mb'
const DEFAULT_SUBTREE_DEPTH = 4
const TREE_DATA_PRETTY = /^(1|true|yes)$/i.test(process.env.TREE_DATA_PRETTY || '')
const RAW_ALLOWED_ORIGINS = (process.env.TREE_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
const ALLOWED_ORIGINS = RAW_ALLOWED_ORIGINS.filter(origin => origin !== '*')
const ADMIN_API_TOKEN = typeof process.env.TREE_ADMIN_TOKEN === 'string' && process.env.TREE_ADMIN_TOKEN.trim()
  ? process.env.TREE_ADMIN_TOKEN.trim()
  : null
const ONE_HOUR_SECONDS = 60 * 60
const ONE_DAY_SECONDS = ONE_HOUR_SECONDS * 24
const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7
const IMMUTABLE_STATIC_EXTENSIONS = new Set(['.js', '.css', '.map', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2'])
const TREE_SEED_JSON = typeof process.env.TREE_SEED_JSON === 'string' && process.env.TREE_SEED_JSON.trim()
  ? path.resolve(process.env.TREE_SEED_JSON.trim())
  : null
const DEFAULT_SEED_DATASET = {
  data: [
    {
      id: 'unknown-person',
      data: {
        'first name': 'Inconnu',
        'last name': 'Profil',
        gender: ''
      },
      rels: {
        spouses: [],
        children: [],
        parents: []
      },
      main: true,
      unknown: true
    }
  ],
  config: {
    mainId: 'unknown-person',
    cardXSpacing: 240,
    cardYSpacing: 140,
    orientation: 'vertical',
    miniTree: false
  },
  meta: {
    seeded: true,
    source: 'default-empty-profile',
    seedVersion: '2025-11-unknown-profile'
  }
};

let lastBackupHash = null

const corsMiddleware = buildCorsMiddleware()

function maskDatabaseUrl(rawUrl) {
  if (!rawUrl) return ''
  try {
    const url = new URL(rawUrl)
    if (url.password) {
      url.password = '***'
    }
    return url.toString()
  } catch (error) {
    return rawUrl
  }
}

function buildCorsMiddleware() {
  if (!RAW_ALLOWED_ORIGINS.length || RAW_ALLOWED_ORIGINS.includes('*')) {
    return cors()
  }

  const allowed = new Set(ALLOWED_ORIGINS)

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowed.has(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true
  })
}

function extractBearerToken(headerValue = '') {
  const parts = headerValue.trim().split(/\s+/)
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1]
  }
  return ''
}

function ensureAdminAuth(req, res, next) {
  if (!ADMIN_API_TOKEN) {
    next()
    return
  }

  const headerToken = (req.get('x-admin-token') || '').trim()
  const bearerToken = extractBearerToken(req.get('authorization') || '')
  const candidate = headerToken || bearerToken

  if (candidate && candidate === ADMIN_API_TOKEN) {
    next()
    return
  }

  res.setHeader('WWW-Authenticate', 'Bearer realm="FamilyTreeAdmin"')
  res.status(401).json({ message: 'Admin authentication required' })
}

const uploadStorage = multer.diskStorage({
  // Always write into the base DOCUMENT_DIR with a unique temporary filename.
  // We will move/rename the file into a person subfolder after multer completes
  // so we don't rely on multipart field parsing inside multer callbacks.
  destination: (req, file, cb) => {
    try { fsSync.mkdirSync(DOCUMENT_DIR, { recursive: true }) } catch (e) { /* ignore */ }
    cb(null, DOCUMENT_DIR)
  },
  filename: (req, file, cb) => {
    const ext = resolveFileExtension(file)
    const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const baseName = sanitizeFileName(path.parse(file.originalname || '').name) || 'image'
    cb(null, `${baseName}-${uniqueId}${ext}`)
  }
})

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      const error = new Error('UNSUPPORTED_FILE_TYPE')
      error.code = 'UNSUPPORTED_FILE_TYPE'
      return cb(error)
    }
    if (file.mimetype === 'image/svg+xml') {
      const error = new Error('UNSUPPORTED_FILE_TYPE_SVG')
      error.code = 'UNSUPPORTED_FILE_TYPE_SVG'
      return cb(error)
    }
    cb(null, true)
  }
})

const uploadSingleImage = uploadMiddleware.single('file')

function sanitizeFileName(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function resolveFileExtension(file) {
  const originalExt = path.extname(file.originalname || '').toLowerCase()
  if (originalExt) return originalExt
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg'
  }
  return map[file.mimetype] || ''
}

function cloneSeedPayload(payload) {
  return JSON.parse(JSON.stringify(payload))
}

async function ensureDatabase() {
  await fs.mkdir(TREE_DATA_DIR, { recursive: true })
  const seedPayload = await loadSeedPayload()
  await initialiseDatabase(() => seedPayload)
  try {
    const current = normaliseTreePayloadRoot(await readTreeData())
    const hasPersons = Array.isArray(current.data) && current.data.length > 0
    if (!hasPersons) {
      const fallbackSeed = cloneSeedPayload(DEFAULT_SEED_DATASET)
      await writeTreeData(fallbackSeed)
    }
  } catch (error) {
    console.warn('[server] Unable to inspect database contents during initialisation', error)
  }
}

async function ensureDocumentDir() {
  await fs.mkdir(DOCUMENT_DIR, { recursive: true })
}

async function ensureBackupDir() {
  await fs.mkdir(TREE_BACKUP_DIR, { recursive: true })
}

async function loadSeedPayload() {
  if (TREE_SEED_JSON) {
    try {
      const raw = await fs.readFile(TREE_SEED_JSON, 'utf8')
      return JSON.parse(raw)
    } catch (error) {
      console.warn(`[server] Unable to read TREE_SEED_JSON at ${TREE_SEED_JSON}:`, error)
    }
  }

  return cloneSeedPayload(DEFAULT_SEED_DATASET)
}

async function readTreeData() {
  return getTreePayload()
}

async function writeTreeData(data, options) {
  const payloadString = serialiseTreeData(data)
  await setTreePayload(data, () => payloadString, options)
  await writeBackupSnapshot(payloadString)
}

function serialiseTreeData(data) {
  const payload = TREE_DATA_PRETTY ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  return payload.endsWith('\n') ? payload : `${payload}\n`
}

function setStaticCacheHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    return
  }

  if (IMMUTABLE_STATIC_EXTENSIONS.has(ext)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_WEEK_SECONDS}, stale-while-revalidate=${ONE_DAY_SECONDS}`)
    return
  }

  res.setHeader('Cache-Control', `public, max-age=${ONE_HOUR_SECONDS}`)
}

function normaliseTreePayloadRoot(payload) {
  if (Array.isArray(payload)) {
    return { data: payload, config: {}, meta: {} }
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) {
      return {
        data: payload.data,
        config: payload.config || {},
        meta: payload.meta || {}
      }
    }

    if (Array.isArray(payload.tree)) {
      return {
        data: payload.tree,
        config: payload.config || {},
        meta: payload.meta || {}
      }
    }
  }

  return { data: [], config: {}, meta: {} }
}

function parseDepthParam(value, fallback) {
  if (value === undefined) return fallback
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? Math.floor(value) : fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (!normalized || ['all', 'infinite', 'infinity', 'illimite', 'none', 'null'].includes(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed)
  }

  return fallback
}

function parseBooleanParam(value, fallback) {
  if (value === undefined) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
  return fallback
}

function toIdArray(value) {
  if (!value) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .map(id => typeof id === 'string' ? id.trim() : '')
    .filter(Boolean)
}

function clonePersonForSubset(person, includeSet) {
  const rels = person?.rels || {}
  const clone = { ...person }
  if (clone.data && typeof clone.data === 'object') {
    clone.data = { ...clone.data }
  }
  clone.rels = {
    parents: toIdArray(rels.parents).filter(id => includeSet.has(id)),
    children: toIdArray(rels.children).filter(id => includeSet.has(id)),
    spouses: toIdArray(rels.spouses).filter(id => includeSet.has(id))
  }
  return clone
}

function buildSubtree(payload, options = {}) {
  const { data, config } = payload
  const persons = Array.isArray(data) ? data : []
  const total = persons.length

  if (total === 0) {
    const meta = { total: 0, returned: 0, mainId: null, ancestryDepth: null, progenyDepth: null }
    return { data: [], config: { ...config, mainId: null }, meta }
  }

  const byId = new Map()
  persons.forEach(person => {
    if (person && typeof person.id === 'string') {
      byId.set(person.id, person)
    }
  })

  if (byId.size === 0) {
    const meta = { total, returned: 0, mainId: null, ancestryDepth: null, progenyDepth: null }
    return { data: [], config: { ...config, mainId: null }, meta }
  }

  const fallbackMainId = persons.find(person => person && byId.has(person.id))?.id || null
  const configMainId = typeof config?.mainId === 'string' && byId.has(config.mainId) ? config.mainId : null
  const requestedMainId = typeof options.mainId === 'string' && byId.has(options.mainId) ? options.mainId : null
  const mainId = requestedMainId || configMainId || fallbackMainId

  if (!mainId) {
    const meta = { total, returned: 0, mainId: null, ancestryDepth: null, progenyDepth: null }
    return { data: [], config: { ...config, mainId: null }, meta }
  }

  const defaultAncestry = typeof config?.ancestryDepth === 'number' && Number.isFinite(config.ancestryDepth)
    ? Math.max(0, Math.floor(config.ancestryDepth))
    : DEFAULT_SUBTREE_DEPTH

  const defaultProgeny = typeof config?.progenyDepth === 'number' && Number.isFinite(config.progenyDepth)
    ? Math.max(0, Math.floor(config.progenyDepth))
    : DEFAULT_SUBTREE_DEPTH

  const ancestryDepth = options.ancestryDepth === undefined ? defaultAncestry : options.ancestryDepth
  const progenyDepth = options.progenyDepth === undefined ? defaultProgeny : options.progenyDepth

  const ancestryLimit = ancestryDepth === null ? Infinity : Math.max(0, ancestryDepth)
  const progenyLimit = progenyDepth === null ? Infinity : Math.max(0, progenyDepth)

  const include = new Set()
  const ancestryDepthMap = new Map()
  const progenyDepthMap = new Map()

  const includePerson = (id) => {
    if (!id || include.has(id) || !byId.has(id)) return
    include.add(id)
  }

  includePerson(mainId)

  function collectAncestors(startId) {
    const queue = [{ id: startId, depth: 0 }]
    while (queue.length) {
      const { id, depth } = queue.shift()
      if (!byId.has(id)) continue
      const recordedDepth = ancestryDepthMap.get(id)
      if (recordedDepth !== undefined && depth >= recordedDepth) continue
      ancestryDepthMap.set(id, depth)
      includePerson(id)
      if (depth >= ancestryLimit) continue
      const person = byId.get(id)
      const parents = toIdArray(person?.rels?.parents)
      parents.forEach(parentId => {
        if (!byId.has(parentId)) return
        queue.push({ id: parentId, depth: depth + 1 })
      })
    }
  }

  function collectDescendants(startId, startDepth = 0) {
    const queue = [{ id: startId, depth: startDepth }]
    while (queue.length) {
      const { id, depth } = queue.shift()
      if (!byId.has(id)) continue
      const recordedDepth = progenyDepthMap.get(id)
      if (recordedDepth !== undefined && depth >= recordedDepth) continue
      progenyDepthMap.set(id, depth)
      includePerson(id)
      if (depth >= progenyLimit) continue
      const person = byId.get(id)
      const children = toIdArray(person?.rels?.children)
      children.forEach(childId => {
        if (!byId.has(childId)) return
        queue.push({ id: childId, depth: depth + 1 })
      })
    }
  }

  if (ancestryLimit > 0 || ancestryDepth === null) {
    collectAncestors(mainId)
  }

  collectDescendants(mainId, 0)

  if (options.includeSiblings !== false) {
    const mainPerson = byId.get(mainId)
    if (mainPerson) {
      const parents = toIdArray(mainPerson.rels?.parents)
      parents.forEach(parentId => {
        const parent = byId.get(parentId)
        if (!parent) return
        const siblings = toIdArray(parent.rels?.children)
        siblings.forEach(siblingId => includePerson(siblingId))
      })
    }
  }

  const parentsToAdd = new Set()
  include.forEach(id => {
    const depth = progenyDepthMap.get(id)
    if (depth === undefined) return
    const person = byId.get(id)
    if (!person) return
    const parents = toIdArray(person.rels?.parents)
    parents.forEach(parentId => {
      if (!include.has(parentId) && byId.has(parentId)) {
        parentsToAdd.add(parentId)
      }
    })
  })
  parentsToAdd.forEach(parentId => includePerson(parentId))

  if (options.includeSpouses !== false) {
    const spousesToAdd = new Set()
    include.forEach(id => {
      const person = byId.get(id)
      if (!person) return
      const spouses = toIdArray(person.rels?.spouses)
      spouses.forEach(spouseId => {
        if (!include.has(spouseId) && byId.has(spouseId)) {
          spousesToAdd.add(spouseId)
        }
      })
    })
    spousesToAdd.forEach(spouseId => includePerson(spouseId))
  }

  const filtered = persons
    .filter(person => include.has(person.id))
    .map(person => clonePersonForSubset(person, include))

  const resultConfig = {
    ...config,
    mainId
  }

  if (ancestryDepth === null) {
    resultConfig.ancestryDepth = null
  } else {
    resultConfig.ancestryDepth = Math.max(0, ancestryDepth)
  }

  if (progenyDepth === null) {
    resultConfig.progenyDepth = null
  } else {
    resultConfig.progenyDepth = Math.max(0, progenyDepth)
  }

  const meta = {
    total,
    returned: filtered.length,
    mainId,
    ancestryDepth: ancestryDepth === null ? null : Math.max(0, ancestryDepth),
    progenyDepth: progenyDepth === null ? null : Math.max(0, progenyDepth),
    includeSiblings: options.includeSiblings !== false,
    includeSpouses: options.includeSpouses !== false
  }

  return { data: filtered, config: resultConfig, meta }
}

function getDataFieldValue(person, targetKey) {
  if (!person || typeof person !== 'object') return ''
  const data = person.data
  if (!data || typeof data !== 'object') return ''
  const normalizedTarget = targetKey.toLowerCase()
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue
    if (key.toLowerCase() === normalizedTarget) {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return ''
}

function buildPersonSummaryEntry(person) {
  const firstName = getDataFieldValue(person, 'first name')
  const lastName = getDataFieldValue(person, 'last name')
  const nickname = getDataFieldValue(person, 'nickname')
  const maidenName = getDataFieldValue(person, 'maiden name')
  const parts = []
  if (firstName) parts.push(firstName)
  if (lastName) parts.push(lastName)
  const baseLabel = parts.join(' ').replace(/\s+/g, ' ').trim()
  const label = baseLabel || nickname || person.id || 'Profil'

  const summary = { id: person.id, label }
  const birthday = getDataFieldValue(person, 'birthday')
  if (birthday) summary.birthday = birthday
  const death = getDataFieldValue(person, 'death')
  if (death) summary.death = death
  const location = getDataFieldValue(person, 'location') || getDataFieldValue(person, 'residence')
  if (location) summary.location = location
  if (maidenName) summary.maidenName = maidenName
  const gender = getDataFieldValue(person, 'gender')
  if (gender) summary.gender = gender
  const occupation = getDataFieldValue(person, 'occupation')
  if (occupation) summary.occupation = occupation
  const fields = collectPersonStringFields(person)
  if (Object.keys(fields).length) {
    summary.fields = fields
  }
  const searchText = buildPersonSearchText({
    id: person.id,
    label,
    nickname,
    maidenName,
    birthday,
    death,
    location,
    occupation,
    fields
  })
  if (searchText) summary.searchText = searchText
  return summary
}

function collectPersonStringFields(person) {
  const result = {}
  if (!person || typeof person !== 'object') return result
  const data = person.data
  if (!data || typeof data !== 'object') return result
  for (const [rawKey, rawValue] of Object.entries(data)) {
    if (typeof rawValue !== 'string') continue
    const trimmed = rawValue.trim()
    if (!trimmed) continue
    result[rawKey] = trimmed
  }
  return result
}

function buildPersonSearchText({ id, label, nickname, maidenName, birthday, death, location, occupation, fields }) {
  const tokens = new Set()
  const addToken = (value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (!trimmed) return
    tokens.add(trimmed)
  }

  addToken(id)
  addToken(label)
  addToken(nickname)
  addToken(maidenName)
  addToken(birthday)
  addToken(death)
  addToken(location)
  addToken(occupation)

  if (fields && typeof fields === 'object') {
    Object.values(fields).forEach(addToken)
  }

  const combined = Array.from(tokens)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (!combined.length) return ''

  return combined.join(' | ')
}

function buildPeopleSummary(persons) {
  const summaries = persons
    .filter(person => person && typeof person.id === 'string')
    .map(person => buildPersonSummaryEntry(person))
  summaries.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  return summaries
}

function sanitizeBackupName(value = '') {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  if (!/^[a-z0-9_-]+\.json$/.test(normalized)) return ''
  return normalized
}

function formatTimestampForFile(date = new Date()) {
  const iso = date.toISOString()
  return iso.replace(/[:.]/g, '-').replace('T', '_').toLowerCase()
}

async function writeBackupSnapshot(payloadString) {
  if (typeof payloadString !== 'string' || !payloadString.length) return
  await ensureBackupDir()
  const hash = createHash('sha256').update(payloadString).digest('hex')
  if (hash === lastBackupHash) return

  const backupName = `tree-${formatTimestampForFile()}.json`
  const backupPath = path.join(TREE_BACKUP_DIR, backupName)
  await fs.writeFile(backupPath, payloadString, 'utf8')
  lastBackupHash = hash
  await pruneBackups()
}

async function pruneBackups() {
  if (!TREE_BACKUP_LIMIT || TREE_BACKUP_LIMIT <= 0) return

  let entries
  try {
    entries = await fs.readdir(TREE_BACKUP_DIR, { withFileTypes: true })
  } catch (error) {
    return
  }

  const files = await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(async entry => {
      const fullPath = path.join(TREE_BACKUP_DIR, entry.name)
      const stats = await fs.stat(fullPath)
      return { name: entry.name, path: fullPath, mtimeMs: stats.mtimeMs }
    }))

  if (files.length <= TREE_BACKUP_LIMIT) return

  files.sort((a, b) => a.mtimeMs - b.mtimeMs)

  const filesToRemove = files.slice(0, files.length - TREE_BACKUP_LIMIT)
  await Promise.allSettled(filesToRemove.map(file => fs.unlink(file.path)))
}

async function listBackups() {
  try {
    await ensureBackupDir()
    const entries = await fs.readdir(TREE_BACKUP_DIR, { withFileTypes: true })
    const files = await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(async entry => {
        const fullPath = path.join(TREE_BACKUP_DIR, entry.name)
        const stats = await fs.stat(fullPath)
        return {
          name: entry.name,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        }
      }))
    files.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1))
    return files
  } catch (error) {
    console.error('[server] Unable to list backups', error)
    return []
  }
}

async function resolveBackupPath(name) {
  const safeName = sanitizeBackupName(name)
  if (!safeName) return null
  const candidatePath = path.join(TREE_BACKUP_DIR, safeName)
  const absoluteBackupDir = path.resolve(TREE_BACKUP_DIR)
  const absoluteCandidate = path.resolve(candidatePath)
  if (!absoluteCandidate.startsWith(absoluteBackupDir)) return null

  try {
    await fs.access(absoluteCandidate)
    return absoluteCandidate
  } catch (error) {
    return null
  }
}

function createTreeApi({ canWrite }) {
  const router = express.Router()
  router.use(corsMiddleware)
  router.options('*', corsMiddleware)
  router.use((error, req, res, next) => {
    if (error && error.message === 'Not allowed by CORS') {
      res.status(403).json({ message: 'CORS origin denied' })
      return
    }
    next(error)
  })

  router.get('/tree', async (req, res) => {
    try {
      // New: Always use SQL Subset Retrieval for scalability
      const ancestryDepthParam = req.query.ancestryDepth ?? req.query.ancestry_depth
      const progenyDepthParam = req.query.progenyDepth ?? req.query.progeny_depth
      const mainIdParam = req.query.mainId ?? req.query.main_id

      const ancestryDepth = parseDepthParam(ancestryDepthParam, 10)
      const progenyDepth = parseDepthParam(progenyDepthParam, 10)
      const mainId = typeof mainIdParam === 'string' && mainIdParam.trim() ? mainIdParam.trim() : null

      // This replaces the old 'readTreeData' + 'buildSubtree' which loaded full JSON.
      const subtree = await getTreeSubset({
        mainId,
        ancestryDepth,
        progenyDepth
      })

      res.json(subtree)
    } catch (error) {
      console.error('[server] Failed to retrieve tree subset', error)
      res.status(500).json({ message: 'Unable to retrieve tree data' })
    }
  })

  router.get('/tree/summary', async (req, res) => {
    try {
      const payload = await readTreeData()
      const normalised = normaliseTreePayloadRoot(payload)
      const persons = Array.isArray(normalised.data) ? normalised.data : []
      const summaries = buildPeopleSummary(persons)
      const updatedAt = await getLastUpdatedAt()

      res.json({
        total: persons.length,
        updatedAt,
        mainId: typeof normalised.config?.mainId === 'string' ? normalised.config.mainId : null,
        persons: summaries
      })
    } catch (error) {
      console.error('[server] Failed to build tree summary', error)
      res.status(500).json({ message: 'Unable to summarise tree data' })
    }
  })

  router.get('/backups', async (req, res) => {
    try {
      const backups = await listBackups()
      res.json(backups)
    } catch (error) {
      res.status(500).json({ message: 'Unable to list backups' })
    }
  })

  router.get('/backups/:name', async (req, res) => {
    try {
      const backupPath = await resolveBackupPath(req.params.name)
      if (!backupPath) {
        res.status(404).json({ message: 'Backup not found' })
        return
      }
      res.sendFile(backupPath)
    } catch (error) {
      res.status(500).json({ message: 'Unable to retrieve backup' })
    }
  })

  if (canWrite) {
    const jsonParser = express.json({ limit: TREE_PAYLOAD_LIMIT })

    router.put('/tree', ensureAdminAuth, jsonParser, async (req, res) => {
      try {
        const payload = req.body
        if (!payload || typeof payload !== 'object') {
          res.status(400).json({ message: 'Invalid payload: expected JSON object or array' })
          return
        }

        await writeTreeData(payload)
        res.status(204).end()
      } catch (error) {
        console.error('[server] Failed to write tree data', error)
        res.status(500).json({ message: 'Unable to persist tree data file' })
      }
    })


    router.post('/admin/import', ensureAdminAuth, jsonParser, async (req, res) => {
      try {
        const body = req.body
        const hasPayloadField = body && typeof body === 'object' && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, 'payload')
        const payload = hasPayloadField ? body.payload : body

        if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
          res.status(400).json({ message: 'Invalid payload: expected JSON object or array' })
          return
        }

        let dropIndexes = true
        if (hasPayloadField && Object.prototype.hasOwnProperty.call(body, 'dropIndexes')) {
          dropIndexes = parseBooleanParam(body.dropIndexes, true)
        } else if (req.query.dropIndexes !== undefined) {
          dropIndexes = parseBooleanParam(req.query.dropIndexes, true)
        }


        let fastImport = false
        if (hasPayloadField && Object.prototype.hasOwnProperty.call(body, 'fastImport')) {
          fastImport = parseBooleanParam(body.fastImport, false)
        } else if (req.query.fastImport !== undefined) {
          fastImport = parseBooleanParam(req.query.fastImport, false)
        }

        await writeTreeData(payload, { dropIndexes, fastImport })
        res.status(204).end()
      } catch (error) {
        console.error('[server] admin import failed', error)
        res.status(500).json({ message: 'Import failed', error: String(error) })
      }
    })

    const uploadGedcom = multer({ dest: DOCUMENT_DIR })

    router.post('/admin/import-gedcom', ensureAdminAuth, uploadGedcom.single('file'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

        console.log('[server] Starting streaming GEDCOM import:', req.file.path)
        await importGedcomStream(req.file.path)

        // Clean up temp file
        await fs.unlink(req.file.path)

        res.status(204).end()
      } catch (error) {
        console.error('[server] Streaming import failed', error)
        res.status(500).json({ message: 'Import failed', error: String(error) })
      }
    })

    router.post('/admin/rebuild-fts', ensureAdminAuth, async (req, res) => {
      try {
        const result = await rebuildFts()
        res.json(result)
      } catch (error) {
        console.error('[server] rebuild-fts failed', error)
        res.status(500).json({ message: 'FTS rebuild failed', error: String(error) })
      }
    })

    router.post('/admin/reset-to-seed', ensureAdminAuth, async (req, res) => {

      const confirm = req.query.confirm === '1' || req.query.confirm === 'true'
      if (!confirm) {
        res.status(400).json({ message: 'Missing confirm=1 query param to reset database to seed' })
        return
      }
      try {
        const seedPayload = await loadSeedPayload()
        await writeTreeData(seedPayload)
        res.status(204).end()
      } catch (error) {
        console.error('[server] reset-to-seed failed', error)
        res.status(500).json({ message: 'Reset to seed failed', error: String(error) })
      }
    })
  }

  return router
}

function createStaticApp(staticFolder, { canWrite }) {
  const app = express()

  app.use(compression({ threshold: 1024 }))
  const staticOptions = { setHeaders: setStaticCacheHeaders }
  app.use('/lib', express.static(DIST_DIR, staticOptions))
  app.use('/assets', express.static(path.resolve(ROOT_DIR, 'src', 'styles'), staticOptions))

  app.use('/static', express.static(STATIC_DIR, staticOptions))
  app.use('/document', express.static(DOCUMENT_DIR, { maxAge: '1d' }))
  app.use('/api', createTreeApi({ canWrite }))

  if (canWrite) {
    app.post('/api/document', ensureAdminAuth, (req, res) => {
      uploadSingleImage(req, res, (error) => {
        if (error) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ message: `Fichier trop volumineux (limite ${MAX_UPLOAD_SIZE_MB} Mo).` })
            return
          }
          if (error.code === 'UNSUPPORTED_FILE_TYPE') {
            res.status(415).json({ message: 'Format non pris en charge. Téléversez une image (JPEG, PNG, WebP, GIF, SVG).' })
            return
          }
          console.error('[server] Upload failed', error)
          res.status(500).json({ message: 'Impossible de téléverser ce fichier.' })
          return
        }

        if (!req.file) {
          res.status(400).json({ message: 'Aucun fichier reçu.' })
          return
        }

        // By default assume file is at /document/<filename>
        (async () => {
          let publicPath = `/document/${req.file.filename}`
          try {
            // Determine if uploader provided a personId and move/rename the file
            const possible = (req.body && (req.body.personId || req.body.person_id)) || req.query?.personId || req.query?.person_id
            if (possible && typeof possible === 'string' && possible.trim()) {
              const safeId = sanitizeFileName(possible) || 'unknown'
              const targetDir = path.join(DOCUMENT_DIR, safeId)
              await fs.mkdir(targetDir, { recursive: true })

              const ext = path.extname(req.file.filename) || resolveFileExtension(req.file) || ''
              const tempPath = req.file.path || path.join(req.file.destination || DOCUMENT_DIR, req.file.filename)
              const targetPath = path.join(targetDir, `profil${ext}`)

              try {
                await fs.rename(tempPath, targetPath)
              } catch (renameErr) {
                try {
                  // Fallback for cross-device rename
                  await fs.copyFile(tempPath, targetPath)
                  await fs.unlink(tempPath)
                } catch (copyErr) {
                  console.error('[server] Failed to move uploaded file', renameErr, copyErr)
                  // If move failed, leave the file where multer saved it and continue
                }
              }

              publicPath = `/document/${safeId}/profil${ext}`
            } else {
              // If no personId, try to resolve any subfolder used by multer
              try {
                const rel = path.relative(DOCUMENT_DIR, req.file.destination || '')
                if (rel && rel !== '') {
                  const folder = rel.split(path.sep).filter(Boolean).join('/')
                  publicPath = `/document/${folder}/${req.file.filename}`
                }
              } catch (e) {
                /* ignore and fallback */
              }
            }
          } catch (e) {
            console.error('[server] Post-upload processing failed', e)
          }

          res.status(201).json({
            url: publicPath,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype
          })
        })()
      })
    })

    // Delete profile image for a person (removes any profil.* files in the person folder)
    app.delete('/api/document', ensureAdminAuth, async (req, res) => {
      try {
        const possible = (req.query?.personId || req.query?.person_id) || (req.body && (req.body.personId || req.body.person_id))
        if (!possible || typeof possible !== 'string' || !possible.trim()) {
          res.status(400).json({ message: 'personId manquant' })
          return
        }

        // Build a list of candidate folders to check in order of likelihood:
        //  - sanitized personId
        //  - sanitized short id (take left part before colon if present)
        //  - raw personId (sanitized again to be safe)
        // If none of those exist, also check the DOCUMENT_DIR root for any profil.* file.
        const raw = possible.trim()
        const safeFull = sanitizeFileName(raw) || 'unknown'
        const short = (raw.split(':')[0] || raw)
        const safeShort = sanitizeFileName(short) || safeFull

        const candidates = [...new Set([safeFull, safeShort])]

        const foundFiles = []

        for (const safeId of candidates) {
          const candidateDir = path.join(DOCUMENT_DIR, safeId)
          try {
            const entries = await fs.readdir(candidateDir, { withFileTypes: true })
            const profilFiles = entries
              .filter(e => e.isFile() && /^profil\./i.test(e.name))
              .map(e => path.join(candidateDir, e.name))
            if (profilFiles.length) foundFiles.push(...profilFiles)
          } catch (err) {
            if (err && err.code === 'ENOENT') {
              // folder doesn't exist — continue with next candidate
              continue
            }
            throw err
          }
        }

        // fallback: check DOCUMENT_DIR root for profil.* files
        if (!foundFiles.length) {
          try {
            const rootEntries = await fs.readdir(DOCUMENT_DIR, { withFileTypes: true })
            const rootProfil = rootEntries
              .filter(e => e.isFile() && /^profil\./i.test(e.name))
              .map(e => path.join(DOCUMENT_DIR, e.name))
            if (rootProfil.length) foundFiles.push(...rootProfil)
          } catch (err) {
            // ignore root read errors (unlikely)
          }
        }

        if (!foundFiles.length) {
          res.status(404).json({ message: 'Aucun fichier trouvé pour ce profil', tried: candidates })
          return
        }

        await Promise.allSettled(foundFiles.map(p => fs.unlink(p)))
        res.status(204).end()
      } catch (error) {
        console.error('[server] Failed to delete profile image', error)
        res.status(500).json({ message: 'Impossible de supprimer le fichier' })
      }
    })
  }

  app.use(express.static(staticFolder, { extensions: ['html'], setHeaders: setStaticCacheHeaders }))

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticFolder, 'index.html'))
  })

  return app
}

async function start() {
  await ensureDatabase()
  await ensureDocumentDir()
  await ensureBackupDir()
  try {
    await fs.access(DIST_DIR)
  } catch (error) {
    console.warn(`[server] Aucun dossier dist trouvé. Lancez "npm run build" avant de démarrer le serveur.`)
  }

  const viewerStatic = path.resolve(STATIC_DIR, 'viewer')
  const builderStatic = path.resolve(STATIC_DIR, 'builder')

  const viewerApp = createStaticApp(viewerStatic, { canWrite: false })
  const builderApp = createStaticApp(builderStatic, { canWrite: true })

  viewerApp.listen(VIEWER_PORT, () => {
    console.log(`[server] Viewer running on port ${VIEWER_PORT}`)
    console.log(`[server] Using PostgreSQL at ${maskDatabaseUrl(getDatabaseUrl())}`)
  })

  builderApp.listen(BUILDER_PORT, () => {
    console.log(`[server] Builder running on port ${BUILDER_PORT}`)
  })
}

start().catch((error) => {
  console.error('[server] Fatal error, shutting down', error)
  process.exit(1)
})
