#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import {
  initialiseDatabase,
  getTreePayload,
  setTreePayload
} from '../server/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

async function compactTree(targetPath) {
  const dbPath = path.resolve(
    ROOT_DIR,
    targetPath || process.env.TREE_DB_PATH || process.env.TREE_DATA_PATH || 'data/family.db'
  )

  initialiseDatabase(dbPath)
  const payload = getTreePayload(dbPath)
  const serialised = JSON.stringify(payload)
  setTreePayload(dbPath, payload, () => `${serialised}\n`)

  const exportDir = path.dirname(dbPath)
  await fs.mkdir(exportDir, { recursive: true })
  const exportName = path.basename(dbPath, path.extname(dbPath))
  const exportPath = path.join(exportDir, `${exportName}-export.json`)
  await fs.writeFile(exportPath, `${serialised}\n`, 'utf8')
  const gzPath = `${exportPath}.gz`
  await fs.writeFile(gzPath, gzipSync(serialised))

  const relativeDb = path.relative(ROOT_DIR, dbPath) || dbPath
  const relativeExport = path.relative(ROOT_DIR, exportPath) || exportPath
  const relativeGz = path.relative(ROOT_DIR, gzPath) || gzPath

  console.log(`[compact-tree] Compacted dataset stored in ${relativeDb}`) // eslint-disable-line no-console
  console.log(`[compact-tree] Exported JSON snapshot to ${relativeExport}`) // eslint-disable-line no-console
  console.log(`[compact-tree] Wrote gzip archive to ${relativeGz}`) // eslint-disable-line no-console
}

const cliArg = process.argv[2]
compactTree(cliArg).catch(error => {
  console.error('[compact-tree] Failed to compact tree data:', error)
  process.exitCode = 1
})
