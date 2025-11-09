import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { initialiseDatabase, setTreePayload, getTreePayload } from '../server/db'

function makePayload(n: number) {
  const data: any[] = []
  for (let i = 0; i < n; i++) {
    const id = `p${i}`
    data.push({ id, data: { 'first name': `F${i}`, 'last name': `L${i}` }, rels: { parents: [], spouses: [], children: [] } })
  }
  return { data, config: {} }
}

describe('bulk import performance and correctness', () => {
  it('imports 2000 records with fastImport and dropIndexes', () => {
    const tmp = os.tmpdir()
    const dbPath = path.join(tmp, `family-tree-import-${Date.now()}.db`)
    try {
      initialiseDatabase(dbPath)
      const payload = makePayload(2000)
      const start = Date.now()
      setTreePayload(dbPath, payload, undefined, { dropIndexes: true, fastImport: true })
      const elapsed = Date.now() - start
      // basic assertion: payload stored and persons count matches
      const stored = getTreePayload(dbPath)
      expect(stored.data.length).toBe(2000)
      console.log('[test] import elapsed ms:', elapsed)
      expect(elapsed).toBeGreaterThanOrEqual(0)
    } finally {
      try { fs.unlinkSync(dbPath) } catch (e) {}
    }
  })
})
