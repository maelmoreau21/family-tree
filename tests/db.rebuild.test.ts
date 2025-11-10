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
      {
        id: 'p1',
        data: { 'first name': 'Test', 'last name': 'Person' },
        rels: { parents: [], spouses: [], children: [] }
      }
    ],
    config: { mainId: 'p1' }
  }
}

if (!baseConnectionString) {
  describe.skip('DB rebuild and timestamps', () => {
    it('skipped because no PostgreSQL connection string is configured', () => {
      expect(true).toBe(true)
    })
  })
} else {
  describe('DB rebuild and timestamps', () => {
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

    it('creates persons table with created_at and updated_at and populates them', async () => {
      if (!dbModule || !queryPool) throw new Error('Database not initialised for test')
      const payload = createPayload()
      await dbModule.setTreePayload(payload)

      const res = await queryPool.query('SELECT id, created_at, updated_at FROM persons WHERE id = $1', ['p1'])
      expect(res.rowCount).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBe('p1')
      expect(typeof row.created_at).toBe('string')
      expect(typeof row.updated_at).toBe('string')
      expect(row.created_at.length).toBeGreaterThan(0)
      expect(row.updated_at.length).toBeGreaterThan(0)
    }, 30_000)
  })
}
