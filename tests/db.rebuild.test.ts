import { describe, it, expect } from 'vitest'
import { initialiseDatabase, setTreePayload } from '../server/db'
import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

function createPayload() {
  return {
    data: [
      {
        id: 'p1',
        data: { 'first name': 'Test', 'last name': 'Person' },
        rels: { parents: [], spouses: [], children: [] }
      }
    ],
    config: { mainId: 'p1' }
  }
}

describe('DB rebuild and timestamps', () => {
  it('creates persons table with created_at and updated_at and populates them', () => {
    const tmp = os.tmpdir()
    const dbPath = path.join(tmp, `family-tree-test-${Date.now()}.db`)
    try {
      // initialise will create schema
      initialiseDatabase(dbPath)
      const payload = createPayload()

      // write payload (this triggers rebuildRelationalTables)
      setTreePayload(dbPath, payload)

      // query DB directly to assert timestamps
      const conn = new Database(dbPath)
      const row = conn.prepare("SELECT id, created_at, updated_at FROM persons WHERE id = ?").get('p1')
      expect(row).toBeTruthy()
      expect(row.id).toBe('p1')
      expect(typeof row.created_at).toBe('string')
      expect(typeof row.updated_at).toBe('string')
      expect(row.created_at.length).toBeGreaterThan(0)
      expect(row.updated_at.length).toBeGreaterThan(0)
      conn.close()
    } finally {
      try { fs.unlinkSync(dbPath) } catch (e) { /* ignore cleanup errors */ }
    }
  })
})
