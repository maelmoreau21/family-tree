import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { TestDatabaseContext } from './utils/dbTestUtils'
import { createTestDatabase, dropTestDatabase, resolveBaseConnectionString } from './utils/dbTestUtils'
import { Pool } from 'pg'

let dbModule: typeof import('../server/db.js') | null = null
let dbContext: TestDatabaseContext | null = null
let queryPool: Pool | null = null

const baseConnectionString = resolveBaseConnectionString()

function createPayload() {
  return {
    data: [
      { id: 'p1', data: { 'first name': 'A' }, rels: { parents: [], spouses: [], children: ['p2'] } },
      { id: 'p2', data: { 'first name': 'B' }, rels: { parents: ['p1'], spouses: [], children: [] } }
    ],
    config: { mainId: 'p1' }
  }
}

if (!baseConnectionString) {
  describe.skip('rebuildRelationalTables relationships and closure', () => {
    it('skipped because no PostgreSQL connection string is configured', () => {
      expect(true).toBe(true)
    })
  })
} else {
  describe('rebuildRelationalTables relationships and closure', () => {
    beforeAll(async () => {
      dbContext = await createTestDatabase(baseConnectionString)
      process.env.TREE_DATABASE_URL = dbContext.connectionString
      dbModule = await import('../server/db.js')
      await dbModule.initialiseDatabase()
      queryPool = new Pool({ connectionString: dbContext.connectionString })
    }, 30_000)

    afterAll(async () => {
      if (queryPool) {
        await queryPool.end()
      }
      if (dbModule?.closeDatabase) {
        await dbModule.closeDatabase()
      }
      if (dbContext) {
        await dropTestDatabase(dbContext)
      }
    }, 30_000)

    it('populates relationships and closure correctly', async () => {
      if (!dbModule || !queryPool) throw new Error('Database not initialised for test')
      const payload = createPayload()
      await dbModule.setTreePayload(payload)

      const rel = await queryPool.query(
        'SELECT parent_id, child_id FROM relationships WHERE parent_id = $1 AND child_id = $2',
        ['p1', 'p2']
      )
      expect(rel.rowCount).toBe(1)

      const closure = await queryPool.query(
        'SELECT ancestor_id, descendant_id, depth FROM closure WHERE ancestor_id = $1 AND descendant_id = $2',
        ['p1', 'p2']
      )
      expect(closure.rowCount).toBe(1)
      expect(Number(closure.rows[0].depth)).toBeGreaterThanOrEqual(1)
    }, 30_000)
  })
}
