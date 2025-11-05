import express from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import multer from 'multer'
import { randomUUID, createHash } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT_DIR, 'dist')
const STATIC_DIR = path.resolve(ROOT_DIR, 'static')
const UPLOAD_DIR = path.resolve(ROOT_DIR, 'uploads')

const DEFAULT_DATA_PATHS = [
  path.resolve(ROOT_DIR, 'examples', 'data', 'data.json'),
  path.resolve(ROOT_DIR, 'examples', 'data', 'data-first-node.json')
]

const DEFAULT_STORAGE_PATH = path.resolve(ROOT_DIR, 'data', 'tree.json')
const TREE_DATA_PATH = path.resolve(process.env.TREE_DATA_PATH || DEFAULT_STORAGE_PATH)
const TREE_DATA_DIR = path.resolve(process.env.TREE_DATA_DIR || path.dirname(TREE_DATA_PATH))
const TREE_BACKUP_DIR = path.resolve(process.env.TREE_BACKUP_DIR || path.join(TREE_DATA_DIR, 'backups'))
const TREE_BACKUP_LIMIT = Math.max(0, Number.parseInt(process.env.TREE_BACKUP_LIMIT || '50', 10))
const VIEWER_PORT = Number.parseInt(process.env.VIEWER_PORT || '7920', 10)
const BUILDER_PORT = Number.parseInt(process.env.BUILDER_PORT || '7921', 10)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const TREE_PAYLOAD_LIMIT = process.env.TREE_PAYLOAD_LIMIT || '25mb'

let lastBackupHash = null

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const ext = resolveFileExtension(file)
    const baseName = sanitizeFileName(path.parse(file.originalname || '').name) || 'image'
    const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`
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

async function ensureDataFile() {
  try {
    await fs.access(TREE_DATA_PATH)
  } catch (error) {
    const fallbackData = await loadDefaultData()
    await fs.mkdir(TREE_DATA_DIR, { recursive: true })
    await fs.writeFile(TREE_DATA_PATH, JSON.stringify(fallbackData, null, 2), 'utf8')
    console.log(`[server] Created missing data file at ${TREE_DATA_PATH}`)
  }
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

async function ensureBackupDir() {
  await fs.mkdir(TREE_BACKUP_DIR, { recursive: true })
}

async function loadDefaultData() {
  for (const candidate of DEFAULT_DATA_PATHS) {
    try {
      const raw = await fs.readFile(candidate, 'utf8')
      return JSON.parse(raw)
    } catch (error) {
      // continue with next fallback file
    }
  }

  console.warn('[server] No default data found, creating empty dataset')
  return []
}

async function readTreeData() {
  const raw = await fs.readFile(TREE_DATA_PATH, 'utf8')
  return JSON.parse(raw)
}

async function writeTreeData(data) {
  const payloadString = JSON.stringify(data, null, 2)
  const tempPath = `${TREE_DATA_PATH}.tmp`
  await fs.writeFile(tempPath, payloadString, 'utf8')
  await fs.rename(tempPath, TREE_DATA_PATH)
  await writeBackupSnapshot(payloadString)
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
  router.use(cors())

  router.get('/tree', async (req, res) => {
    try {
      await fs.access(TREE_DATA_PATH)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      const stream = createReadStream(TREE_DATA_PATH, { encoding: 'utf8' })
      stream.on('error', (error) => {
        console.error('[server] Failed to stream tree data', error)
        if (!res.headersSent) {
          res.status(500).json({ message: 'Unable to read tree data file' })
        } else {
          res.destroy(error)
        }
      })
      stream.pipe(res)
    } catch (error) {
      console.error('[server] Failed to access tree data', error)
      res.status(500).json({ message: 'Unable to read tree data file' })
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
  router.use(express.json({ limit: TREE_PAYLOAD_LIMIT }))

    router.put('/tree', async (req, res) => {
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
  }

  return router
}

function createStaticApp(staticFolder, { canWrite }) {
  const app = express()

  app.use(compression({ threshold: 1024 }))
  app.use('/lib', express.static(DIST_DIR))
  app.use('/assets', express.static(path.resolve(ROOT_DIR, 'src', 'styles')))
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }))
  app.use('/api', createTreeApi({ canWrite }))

  if (canWrite) {
    app.post('/api/uploads', (req, res) => {
      uploadSingleImage(req, res, (error) => {
        if (error) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ message: 'Fichier trop volumineux (limite 5 Mo).' })
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

        res.status(201).json({
          url: `/uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        })
      })
    })
  }

  app.use(express.static(staticFolder, { extensions: ['html'] }))

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticFolder, 'index.html'))
  })

  return app
}

async function start() {
  await ensureDataFile()
  await ensureUploadDir()
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
    console.log(`[server] Serving data from ${TREE_DATA_PATH}`)
  })

  builderApp.listen(BUILDER_PORT, () => {
    console.log(`[server] Builder running on port ${BUILDER_PORT}`)
  })
}

start().catch((error) => {
  console.error('[server] Fatal error, shutting down', error)
  process.exit(1)
})
