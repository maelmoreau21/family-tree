import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import multer from 'multer'
import { randomUUID } from 'node:crypto'

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

const TREE_DATA_PATH = process.env.TREE_DATA_PATH || path.resolve('/data/tree.json')
const VIEWER_PORT = Number.parseInt(process.env.VIEWER_PORT || '7920', 10)
const BUILDER_PORT = Number.parseInt(process.env.BUILDER_PORT || '7921', 10)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024

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
    await fs.mkdir(path.dirname(TREE_DATA_PATH), { recursive: true })
    await fs.writeFile(TREE_DATA_PATH, JSON.stringify(fallbackData, null, 2), 'utf8')
    console.log(`[server] Created missing data file at ${TREE_DATA_PATH}`)
  }
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
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
  const tempPath = `${TREE_DATA_PATH}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tempPath, TREE_DATA_PATH)
}

function createTreeApi({ canWrite }) {
  const router = express.Router()
  router.use(cors())

  router.get('/tree', async (req, res) => {
    try {
      const data = await readTreeData()
      res.json(data)
    } catch (error) {
      console.error('[server] Failed to read tree data', error)
      res.status(500).json({ message: 'Unable to read tree data file' })
    }
  })

  if (canWrite) {
    router.use(express.json({ limit: '5mb' }))

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
