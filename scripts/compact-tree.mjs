#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import {
  initialiseDatabase,
  getTreePayload,
  setTreePayload,
  closeDatabase
} from '../server/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

const DEFAULT_EXPORT_PATH = path.resolve(ROOT_DIR, 'data', 'exports', 'tree-export.json')

async function compactTree(targetPath) {
  const exportPath = targetPath
    ? path.resolve(ROOT_DIR, targetPath)
    : DEFAULT_EXPORT_PATH

  await fs.mkdir(path.dirname(exportPath), { recursive: true })

  await initialiseDatabase()
  const payload = await getTreePayload()
  const serialised = JSON.stringify(payload)
  await setTreePayload(payload, () => `${serialised}\n`)

  await fs.writeFile(exportPath, `${serialised}\n`, 'utf8')
  const gzPath = `${exportPath}.gz`
  await fs.writeFile(gzPath, gzipSync(serialised))

  const relativeExport = path.relative(ROOT_DIR, exportPath) || exportPath
  const relativeGz = path.relative(ROOT_DIR, gzPath) || gzPath

  console.log(`[compact-tree] Exported JSON snapshot to ${relativeExport}`)
  console.log(`[compact-tree] Wrote gzip archive to ${relativeGz}`)

  await closeDatabase()
}

const cliArg = process.argv[2]
compactTree(cliArg).catch(error => {
  console.error('[compact-tree] Failed to compact tree data:', error)
  process.exitCode = 1
})
