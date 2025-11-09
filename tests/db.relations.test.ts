import { describe, it, expect } from 'vitest'
import { initialiseDatabase, setTreePayload } from '../server/db'
import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

function createPayload() {
  return {
    data: [
      { id: 'p1', data: { 'first name': 'A' }, rels: { parents: [], spouses: [], children: ['p2'] } },
      { id: 'p2', data: { 'first name': 'B' }, rels: { parents: ['p1'], spouses: [], children: [] } }
    ],
    config: { mainId: 'p1' }
  }
}

describe('rebuildRelationalTables relationships and closure', () => {
  it('populates relationships and closure correctly', () => {
    const tmp = os.tmpdir()
    const dbPath = path.join(tmp, `family-tree-rel-${Date.now()}.db`)
    try {
      initialiseDatabase(dbPath)
      const payload = createPayload()
      setTreePayload(dbPath, payload)

      const conn = new Database(dbPath)
      const rel = conn.prepare('SELECT parent_id, child_id FROM relationships WHERE parent_id = ? AND child_id = ?').get('p1', 'p2')
      expect(rel).toBeTruthy()
      const closure = conn.prepare('SELECT ancestor_id, descendant_id, depth FROM closure WHERE ancestor_id = ? AND descendant_id = ?').get('p1', 'p2')
      expect(closure).toBeTruthy()
      expect(closure.depth).toBeGreaterThanOrEqual(1)
      conn.close()
    } finally {
      try { fs.unlinkSync(dbPath) } catch (e) {}
    }
  })
})
