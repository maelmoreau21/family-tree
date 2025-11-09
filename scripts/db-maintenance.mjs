#!/usr/bin/env node
import Database from 'better-sqlite3'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const dbArg = process.argv[2] || process.env.TREE_DB_PATH || path.resolve(__dirname, '..', 'data', 'family.db')
  const dbPath = path.resolve(dbArg)
  console.log('[maintenance] Using DB:', dbPath)

  const db = new Database(dbPath)
  try {
    console.log('[maintenance] PRAGMA foreign_keys = ON')
    db.pragma('foreign_keys = ON')

    console.log('[maintenance] Running ANALYZE')
    db.exec('ANALYZE')

    console.log('[maintenance] Running REINDEX')
    db.exec('REINDEX')

    console.log('[maintenance] WAL checkpoint (TRUNCATE)')
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);")
    } catch (e) {
      console.warn('[maintenance] wal_checkpoint failed', e && e.message ? e.message : e)
    }

    // Optional: VACUUM is expensive and locks DB; warn user.
    if (process.env.FORCE_VACUUM === '1') {
      console.log('[maintenance] Running VACUUM (this may take time and lock the DB)')
      db.exec('VACUUM')
    }

    // create backups dir
    const backupDir = path.resolve(path.dirname(dbPath), 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `db-backup-${ts}.db`)
    console.log('[maintenance] Creating online backup to', backupPath)

    // better-sqlite3 provides backup as async function
    try {
      await db.backup(backupPath)
      console.log('[maintenance] Backup complete')
    } catch (e) {
      console.warn('[maintenance] Backup failed', e && e.message ? e.message : e)
    }

    console.log('[maintenance] Done')
  } finally {
    try { db.close() } catch (e) {}
  }
}

main().catch(err => {
  console.error('[maintenance] Fatal', err)
  process.exit(1)
})
