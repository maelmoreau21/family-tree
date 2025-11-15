#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import { getDatabaseUrl } from '../server/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const BACKUP_DIR = path.resolve(process.env.TREE_BACKUP_DIR || path.join(ROOT_DIR, 'data', 'backups'))

function maskConnectionString(rawUrl) {
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

async function runMaintenance() {
  const connectionString = process.env.TREE_MAINTENANCE_URL || getDatabaseUrl()
  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    console.log(`[maintenance] Connected to ${maskConnectionString(connectionString)}`)

    console.log('[maintenance] Running ANALYZE')
    await client.query('ANALYZE')

    if (process.env.FORCE_VACUUM === '1') {
      console.log('[maintenance] Running VACUUM (FULL, ANALYZE)')
      await client.query('VACUUM (FULL, ANALYZE)')
    } else {
      console.log('[maintenance] Running VACUUM ANALYZE on persons table')
      await client.query('VACUUM ANALYZE persons')
    }

    const snapshot = await client.query('SELECT payload FROM dataset WHERE id = $1', ['default'])
    if (!snapshot.rowCount) {
      console.warn('[maintenance] No dataset row found; skipping JSON export')
      return
    }

    const payload = snapshot.rows[0].payload || ''
    await fs.mkdir(BACKUP_DIR, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(BACKUP_DIR, `tree-${timestamp}.json`)
    const contents = payload.endsWith('\n') ? payload : `${payload}\n`
    await fs.writeFile(backupPath, contents, 'utf8')
    const relativeBackup = path.relative(ROOT_DIR, backupPath) || backupPath
    console.log(`[maintenance] Wrote JSON snapshot to ${relativeBackup}`)
  } finally {
    client.release()
    await pool.end()
  }
}

runMaintenance().catch(error => {
  console.error('[maintenance] Fatal', error)
  process.exit(1)
})
