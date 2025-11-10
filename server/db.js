import { Pool } from 'pg'

const DATASET_ID = 'default'
const SCHEMA_VERSION = 1
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/family_tree'

const IMPORT_INDEXES = [
  'idx_persons_given_name',
  'idx_persons_family_name',
  'idx_persons_name'
]

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const PERSON_IMPORT_CHUNK_SIZE = parsePositiveInt(process.env.TREE_IMPORT_PERSON_CHUNK, 500)
const RELATIONSHIP_IMPORT_CHUNK_SIZE = parsePositiveInt(process.env.TREE_IMPORT_RELATIONSHIP_CHUNK, 1000)
const FTS_IMPORT_CHUNK_SIZE = parsePositiveInt(process.env.TREE_IMPORT_FTS_CHUNK, 500)

let pool = null
let ftsEnabled = true
let dropIndexesByDefault = true
let initialised = false

function resolveDatabaseUrl() {
  return process.env.TREE_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL
}

function resolvePoolSize() {
  const raw = process.env.TREE_DB_POOL_SIZE
  if (!raw) return 10
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

export function getDatabaseUrl() {
  return resolveDatabaseUrl()
}

function getPool() {
  if (!pool) {
    const connectionString = resolveDatabaseUrl()
    pool = new Pool({ connectionString, max: resolvePoolSize() })
    pool.on('error', (error) => {
      console.error('[db] Unexpected error on idle PostgreSQL client', error)
    })
  }
  return pool
}

async function withClient(fn) {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS dataset (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      given_name TEXT,
      family_name TEXT,
      birth_date TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS relationships (
      parent_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (parent_id, child_id)
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS closure (
      ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id)
    )
  `)

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS persons_fts (
        id TEXT PRIMARY KEY,
        given_name TEXT,
        family_name TEXT,
        metadata TEXT,
        search TSVECTOR
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_persons_fts_search ON persons_fts USING GIN (search)')
    ftsEnabled = true
  } catch (error) {
    console.warn('[db] FTS setup failed:', error && error.message ? error.message : error)
    ftsEnabled = false
  }

  await ensureIndexes(client)
}

async function ensureIndexes(client) {
  await client.query('CREATE INDEX IF NOT EXISTS idx_dataset_updated_at ON dataset(updated_at)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_persons_given_name ON persons (LOWER(given_name))')
  await client.query('CREATE INDEX IF NOT EXISTS idx_persons_family_name ON persons (LOWER(family_name))')
  await client.query('CREATE INDEX IF NOT EXISTS idx_persons_name ON persons (LOWER(family_name), LOWER(given_name))')
  await client.query('CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_persons_updated_at ON persons(updated_at)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_relationships_parent ON relationships(parent_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_relationships_child ON relationships(child_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_closure_ancestor ON closure(ancestor_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_closure_descendant ON closure(descendant_id)')
}

async function applyMigrations(client) {
  const result = await client.query('SELECT value FROM schema_meta WHERE key = $1', ['schema_version'])
  let currentVersion = result.rowCount ? Number.parseInt(result.rows[0].value, 10) || 0 : 0

  const setVersion = async (version) => {
    await client.query(
      `INSERT INTO schema_meta (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ['schema_version', String(version)]
    )
  }

  if (currentVersion === 0) {
    await setVersion(SCHEMA_VERSION)
    return
  }

  if (currentVersion === SCHEMA_VERSION) {
    return
  }

  if (currentVersion > SCHEMA_VERSION) {
    return
  }

  // Placeholder for future migrations when SCHEMA_VERSION increases.
  await setVersion(SCHEMA_VERSION)
}

function normalisePayload(payload) {
  if (Array.isArray(payload)) {
    return { data: payload, config: {}, meta: {} }
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) {
      return { data: payload.data, config: payload.config || {}, meta: payload.meta || {} }
    }
    if (Array.isArray(payload.tree)) {
      return { data: payload.tree, config: payload.config || {}, meta: payload.meta || {} }
    }
  }
  return { data: [], config: {}, meta: {} }
}

function toPersonRecord(person) {
  const id = typeof person.id === 'string' && person.id.trim() ? person.id.trim() : null
  if (!id) return null
  const data = person.data && typeof person.data === 'object' ? person.data : {}
  const rels = person.rels && typeof person.rels === 'object' ? person.rels : {}
  const extras = {}
  Object.entries(person).forEach(([key, value]) => {
    if (key === 'id' || key === 'data' || key === 'rels') return
    extras[key] = value
  })
  const givenName = typeof data['first name'] === 'string' ? data['first name'] : null
  const familyName = typeof data['last name'] === 'string' ? data['last name'] : null
  const birthDate = typeof data['birthday'] === 'string' ? data['birthday'] : null
  const metadata = { data, rels, extras }
  return { id, givenName, familyName, birthDate, metadata }
}

function collectRelationshipPairs(person, personId) {
  const rels = person.rels && typeof person.rels === 'object' ? person.rels : {}
  const pairs = []
  const parents = Array.isArray(rels.parents) ? rels.parents : []
  parents.forEach(parent => {
    if (typeof parent === 'string' && parent.trim()) {
      pairs.push([parent.trim(), personId])
    } else if (parent && typeof parent === 'object' && typeof parent.id === 'string') {
      pairs.push([parent.id.trim(), personId])
    }
  })
  const children = Array.isArray(rels.children) ? rels.children : []
  children.forEach(child => {
    if (typeof child === 'string' && child.trim()) {
      pairs.push([personId, child.trim()])
    } else if (child && typeof child === 'object' && typeof child.id === 'string') {
      pairs.push([personId, child.id.trim()])
    }
  })
  return pairs
}

async function dropImportIndexes(client) {
  for (const name of IMPORT_INDEXES) {
    await client.query(`DROP INDEX IF EXISTS ${name}`)
  }
}

async function rebuildRelationalTables(client, payload, options = {}) {
  const { data } = normalisePayload(payload)
  const { dropIndexes = dropIndexesByDefault, fastImport = false } = options

  if (dropIndexes) {
    await dropImportIndexes(client)
  }

  if (fastImport) {
    await client.query('SET LOCAL synchronous_commit = OFF')
  }

  await client.query('TRUNCATE TABLE relationships, closure, persons RESTART IDENTITY CASCADE')
  if (ftsEnabled) {
    await client.query('TRUNCATE TABLE persons_fts')
  }

  const timestamp = new Date().toISOString()
  const personRecords = []
  const pendingPairs = []
  const ftsRecords = []

  for (const person of data) {
    const record = toPersonRecord(person)
    if (!record) continue
    personRecords.push(record)
    if (ftsEnabled) {
      ftsRecords.push({
        id: record.id,
        givenName: record.givenName,
        familyName: record.familyName,
        metadata: record.metadata
      })
    }
    const pairs = collectRelationshipPairs(person, record.id)
    for (const pair of pairs) {
      pendingPairs.push(pair)
    }
  }

  if (personRecords.length) {
    const chunkSize = PERSON_IMPORT_CHUNK_SIZE
    for (let i = 0; i < personRecords.length; i += chunkSize) {
      const chunk = personRecords.slice(i, i + chunkSize)
      const values = []
      const placeholders = chunk.map((record, index) => {
        const base = index * 7
        values.push(
          record.id,
          record.givenName,
          record.familyName,
          record.birthDate,
          record.metadata,
          timestamp,
          timestamp
        )
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
      })
      const sql = `
        INSERT INTO persons (id, given_name, family_name, birth_date, metadata, created_at, updated_at)
        VALUES ${placeholders.join(',')}
        ON CONFLICT (id) DO UPDATE SET
          given_name = EXCLUDED.given_name,
          family_name = EXCLUDED.family_name,
          birth_date = EXCLUDED.birth_date,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `
      await client.query(sql, values)
    }
  }

  const knownIds = new Set(personRecords.map(record => record.id))
  const relationshipRecords = []
  const seenPairs = new Set()

  for (const [parent, child] of pendingPairs) {
    if (!parent || !child) continue
    if (!knownIds.has(parent) || !knownIds.has(child)) continue
    const key = `${parent}→${child}`
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    relationshipRecords.push({ parent, child })
  }

  if (relationshipRecords.length) {
    const chunkSize = RELATIONSHIP_IMPORT_CHUNK_SIZE
    for (let i = 0; i < relationshipRecords.length; i += chunkSize) {
      const chunk = relationshipRecords.slice(i, i + chunkSize)
      const values = []
      const placeholders = chunk.map((record, index) => {
        const base = index * 2
        values.push(record.parent, record.child)
        return `($${base + 1}, $${base + 2})`
      })
      const sql = `
        INSERT INTO relationships (parent_id, child_id)
        VALUES ${placeholders.join(',')}
        ON CONFLICT DO NOTHING
      `
      await client.query(sql, values)
    }
  }

  await client.query('INSERT INTO closure (ancestor_id, descendant_id, depth) SELECT id, id, 0 FROM persons')
  await client.query(`
    WITH RECURSIVE tree AS (
      SELECT parent_id AS ancestor_id, child_id AS descendant_id, 1 AS depth FROM relationships
      UNION ALL
      SELECT t.ancestor_id, r.child_id, t.depth + 1
      FROM tree t
      JOIN relationships r ON r.parent_id = t.descendant_id
    )
    INSERT INTO closure (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, descendant_id, depth FROM tree
    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING
  `)

  if (ftsEnabled) {
    await client.query('TRUNCATE TABLE persons_fts')
    if (ftsRecords.length) {
      const chunkSize = FTS_IMPORT_CHUNK_SIZE
      for (let i = 0; i < ftsRecords.length; i += chunkSize) {
        const chunk = ftsRecords.slice(i, i + chunkSize)
        const values = []
        const placeholders = chunk.map((record, index) => {
          const metadataText = JSON.stringify(record.metadata ?? {})
          const searchSource = [record.id, record.givenName, record.familyName, metadataText]
            .filter(Boolean)
            .join(' ')
          const base = index * 5
          values.push(
            record.id,
            record.givenName,
            record.familyName,
            metadataText,
            searchSource
          )
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, to_tsvector('simple', $${base + 5}))`
        })
        const sql = `
          INSERT INTO persons_fts (id, given_name, family_name, metadata, search)
          VALUES ${placeholders.join(',')}
          ON CONFLICT (id) DO UPDATE SET
            given_name = EXCLUDED.given_name,
            family_name = EXCLUDED.family_name,
            metadata = EXCLUDED.metadata,
            search = EXCLUDED.search
        `
        await client.query(sql, values)
      }
    }
  }

  if (dropIndexes) {
    await ensureIndexes(client)
  }
}

export async function initialiseDatabase(seedLoader) {
  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await ensureSchema(client)
      await applyMigrations(client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  const existing = await withClient(async (client) => {
    const result = await client.query('SELECT payload FROM dataset WHERE id = $1', [DATASET_ID])
    return result.rowCount ? result.rows[0] : null
  })

  if (!existing) {
    const fallback = typeof seedLoader === 'function'
      ? await Promise.resolve(seedLoader())
      : { data: [], config: {}, meta: {} }
    await setTreePayload(fallback)
  }

  initialised = true
  return getPool()
}

export async function getTreePayload() {
  const row = await withClient(async (client) => {
    const result = await client.query('SELECT payload FROM dataset WHERE id = $1', [DATASET_ID])
    return result.rowCount ? result.rows[0] : null
  })

  if (!row) {
    return { data: [], config: {}, meta: {} }
  }

  try {
    return JSON.parse(row.payload)
  } catch (error) {
    console.error('[db] Unable to parse stored payload', error)
    return { data: [], config: {}, meta: {} }
  }
}

export async function setTreePayload(payload, serialiser, options) {
  const normalised = normalisePayload(payload)
  const stringPayload = typeof payload === 'string'
    ? payload
    : serialiser
      ? serialiser(payload)
      : JSON.stringify(payload)
  const timestamp = new Date().toISOString()

  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query(
        `INSERT INTO dataset (id, payload, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
        [DATASET_ID, stringPayload, timestamp]
      )

      await rebuildRelationalTables(client, payload, options)

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  return normalised
}

export async function getLastUpdatedAt() {
  const row = await withClient(async (client) => {
    const result = await client.query('SELECT updated_at FROM dataset WHERE id = $1', [DATASET_ID])
    return result.rowCount ? result.rows[0] : null
  })

  if (!row) return null
  const value = row.updated_at
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export async function rebuildFts() {
  if (!ftsEnabled) {
    throw new Error('FTS not enabled in this PostgreSQL instance')
  }

  const insertFtsText = `
    INSERT INTO persons_fts (id, given_name, family_name, metadata, search)
    VALUES ($1, $2, $3, $4, to_tsvector('simple', $5))
  `

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query('TRUNCATE TABLE persons_fts')
      const result = await client.query('SELECT id, given_name, family_name, metadata FROM persons')
      let inserted = 0
      for (const row of result.rows) {
        const metadataText = JSON.stringify(row.metadata ?? {})
        const searchSource = [row.id, row.given_name, row.family_name, metadataText]
          .filter(Boolean)
          .join(' ')
        await client.query(insertFtsText, [
          row.id,
          row.given_name,
          row.family_name,
          metadataText,
          searchSource
        ])
        inserted += 1
      }
      await client.query('COMMIT')
      return { ok: true, inserted }
    } catch (error) {
      await client.query('ROLLBACK')
      console.warn('[db] rebuildFts failed', error && error.message ? error.message : error)
      throw error
    }
  })
}

export async function resetToSeed(seedPayload) {
  return setTreePayload(seedPayload)
}

export async function closeDatabase() {
  if (pool) {
    await pool.end()
    pool = null
  }
  initialised = false
}
