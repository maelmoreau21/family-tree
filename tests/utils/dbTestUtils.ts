import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export interface TestDatabaseContext {
  connectionString: string
  adminPool: Pool
  databaseName: string
}

export function resolveBaseConnectionString(): string | null {
  return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || process.env.TREE_DATABASE_URL || null
}

function resolveAdminConnectionString(baseConnectionString: string): string {
  if (process.env.TEST_DATABASE_ADMIN_URL) {
    return process.env.TEST_DATABASE_ADMIN_URL
  }
  const url = new URL(baseConnectionString)
  url.pathname = '/postgres'
  return url.toString()
}

function buildDatabaseUrl(baseConnectionString: string, databaseName: string): string {
  const url = new URL(baseConnectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

export async function createTestDatabase(baseConnectionString: string): Promise<TestDatabaseContext> {
  const databaseName = `family_tree_test_${Date.now()}_${randomUUID().slice(0, 8)}`
  const adminConnection = resolveAdminConnectionString(baseConnectionString)
  const adminPool = new Pool({ connectionString: adminConnection })
  await adminPool.query(`CREATE DATABASE "${databaseName}"`)
  return {
    connectionString: buildDatabaseUrl(baseConnectionString, databaseName),
    adminPool,
    databaseName
  }
}

export async function dropTestDatabase(context: TestDatabaseContext): Promise<void> {
  const { adminPool, databaseName } = context
  try {
    await adminPool.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
  } catch (error) {
    await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [databaseName])
    await adminPool.query(`DROP DATABASE "${databaseName}"`)
  } finally {
    await adminPool.end()
  }
}
