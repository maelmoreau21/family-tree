import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { TestDatabaseContext } from './utils/dbTestUtils'
import { createTestDatabase, dropTestDatabase, resolveBaseConnectionString } from './utils/dbTestUtils'

let dbModule: typeof import('../server/db.js') | null = null
let dbContext: TestDatabaseContext | null = null

const baseConnectionString = resolveBaseConnectionString()

function makePayload(n: number) {
  const data: any[] = []
  for (let i = 0; i < n; i++) {
    const id = `p${i}`
    data.push({ id, data: { 'first name': `F${i}`, 'last name': `L${i}` }, rels: { parents: [], spouses: [], children: [] } })
  }
  return { data, config: {} }
}

  if (!baseConnectionString) {
    describe.skip('bulk import performance and correctness', () => {
      it('skipped because no PostgreSQL connection string is configured', () => {
        expect(true).toBe(true)
      })
    })
  } else {
    describe('bulk import performance and correctness', () => {
      beforeAll(async () => {
        dbContext = await createTestDatabase(baseConnectionString)
        process.env.TREE_DATABASE_URL = dbContext.connectionString
        dbModule = await import('../server/db.js')
        await dbModule.initialiseDatabase()
      }, 30_000)

      afterAll(async () => {
        if (dbModule?.closeDatabase) {
          await dbModule.closeDatabase()
        }
        if (dbContext) {
          await dropTestDatabase(dbContext)
        }
      }, 30_000)

      it('imports 2000 records with fastImport and dropIndexes', async () => {
        if (!dbModule) throw new Error('Database module not initialised')
        const payload = makePayload(2000)
        const start = Date.now()
        await dbModule.setTreePayload(payload, undefined, { dropIndexes: true, fastImport: true })
        const elapsed = Date.now() - start
        const stored = await dbModule.getTreePayload()
        expect(stored.data.length).toBe(2000)
        console.log('[test] import elapsed ms:', elapsed)
        expect(elapsed).toBeGreaterThanOrEqual(0)
      }, 30_000)
    })
  }
