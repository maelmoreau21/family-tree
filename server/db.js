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

}

// --- Streaming Import Support ---

export async function createImportBuffer(options = {}) {
  const { dropIndexes = true } = options
  const client = await getPool().connect()

  await client.query('BEGIN')

  if (dropIndexes) {
    await dropImportIndexes(client)
  }

  // Clear existing data? For a full import: yes.
  // We'll perform a truncate here assuming 'Import Tree' semantics.
  await client.query('TRUNCATE TABLE relationships, closure, persons RESTART IDENTITY CASCADE')
  if (ftsEnabled) await client.query('TRUNCATE TABLE persons_fts')

  let personBuffer = []
  let relBuffer = []
  const personLimit = 1000
  const relLimit = 1000

  async function flushPersons() {
    if (personBuffer.length === 0) return
    const values = []
    const placeholders = personBuffer.map((p, i) => {
      const base = i * 7
      values.push(p.id, p.givenName, p.familyName, p.birthDate, p.metadata, p.createdAt, p.updatedAt)
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
    })

    // We intentionally ignore ON CONFLICT update for speed in initial bulk load, 
    // or we can use DO NOTHING if IDs are unique.
    const sql = `
      INSERT INTO persons (id, given_name, family_name, birth_date, metadata, created_at, updated_at)
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO NOTHING
    `
    await client.query(sql, values)
    personBuffer = []
  }

  async function flushRels() {
    if (relBuffer.length === 0) return
    const values = []
    const placeholders = relBuffer.map((r, i) => {
      const base = i * 2
      values.push(r.parent, r.child)
      return `($${base + 1}, $${base + 2})`
    })
    const sql = `
      INSERT INTO relationships (parent_id, child_id)
      VALUES ${placeholders.join(',')}
      ON CONFLICT DO NOTHING
    `
    try {
      await client.query(sql, values)
    } catch (batchError) {
      console.warn('[db] Batch relationship insert failed, falling back to individual inserts', batchError.message)
      // Fallback: insert one by one to save valid relationships
      for (const r of relBuffer) {
        try {
          await client.query(
            'INSERT INTO relationships (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [r.parent, r.child]
          )
        } catch (indError) {
          // Ignore FK violations or other errors for individual items
          // console.debug('[db] Skipping invalid relationship', r.parent, r.child, indError.code)
        }
      }
    }
    relBuffer = []
  }

  return {
    addPerson: async (p) => {
      const rec = toPersonRecord(p)
      if (!rec) return
      const now = new Date().toISOString()
      // Augment record with timestamps as toPersonRecord doesn't add them
      personBuffer.push({ ...rec, createdAt: now, updatedAt: now })
      if (personBuffer.length >= personLimit) await flushPersons()
    },
    addRelationship: async (parent, child) => {
      if (!parent || !child) return
      relBuffer.push({ parent, child })
      if (relBuffer.length >= relLimit) await flushRels()
    },
    commit: async () => {
      await flushPersons()
      await flushRels()

      // Post-import cleanup: Closure table & Indexes
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

      if (dropIndexes) {
        await ensureIndexes(client)
      }

      await client.query('COMMIT')
      client.release()
    },
    rollback: async () => {
      try { await client.query('ROLLBACK') } catch (e) { }
      client.release()
    }
  }
}

// --- SQL Subset Retrieval ---

export async function getTreeSubset(options = {}) {
  const { mainId, ancestryDepth = 0, progenyDepth = 0, includeSiblings = true, includeSpouses = true } = options
  const client = await getPool().connect()
  try {
    const includeIds = new Set()
    const loadedPersons = []

    // 1. Identify target IDs
    let rootId = mainId
    if (!rootId) {
      // Attempt to find configured mainId from dataset payload
      const dataset = await getTreePayload()
      if (dataset && dataset.config && typeof dataset.config.mainId === 'string' && dataset.config.mainId.trim()) {
        rootId = dataset.config.mainId.trim()
      }
    }

    if (!rootId) {
      // Still no rootId? Fallback to ANY person in the DB to avoid returning empty
      const res = await client.query('SELECT id FROM persons LIMIT 1')
      if (res.rowCount) rootId = res.rows[0].id
      else return { data: [], config: {}, meta: {} }
    }

    // Verify rootId actually exists in persons table
    const checkRes = await client.query('SELECT 1 FROM persons WHERE id = $1', [rootId])
    if (checkRes.rowCount === 0) {
      // The specific rootId (whether passed or from config) is invalid.
      // Fallback to ANY person again.
      const res = await client.query('SELECT id FROM persons LIMIT 1')
      if (res.rowCount) rootId = res.rows[0].id
      else return { data: [], config: {}, meta: {} }
    }

    // RECURSIVE QUERIES
    // We need to implement the traversal logic in SQL.

    // Ancestry CTE
    const ancestryLimit = (ancestryDepth === null || ancestryDepth === undefined) ? 10 : ancestryDepth
    const progenyLimit = (progenyDepth === null || progenyDepth === undefined) ? 10 : progenyDepth

    const sql = `
       WITH RECURSIVE 
       ancestors AS (
         SELECT parent_id as id, 1 as depth FROM relationships WHERE child_id = $1
         UNION
         SELECT r.parent_id, a.depth + 1 FROM relationships r JOIN ancestors a ON r.child_id = a.id WHERE a.depth < $2
       ),
       descendants AS (
         SELECT child_id as id, 1 as depth FROM relationships WHERE parent_id = $1
         UNION
         SELECT r.child_id, d.depth + 1 FROM relationships r JOIN descendants d ON r.parent_id = d.id WHERE d.depth < $3
       ),
       relatives AS (
         SELECT $1::text as id
         UNION SELECT id FROM ancestors
         UNION SELECT id FROM descendants
       ),
       spouses AS (
         SELECT jsonb_array_elements_text(p.metadata->'rels'->'spouses') as id
         FROM persons p
         JOIN relatives r ON p.id = r.id
         WHERE p.metadata->'rels'->'spouses' IS NOT NULL AND jsonb_typeof(p.metadata->'rels'->'spouses') = 'array'
       ),
       final_ids AS (
         SELECT id FROM relatives
         UNION
         SELECT id FROM spouses WHERE ${includeSpouses}
       )
       SELECT p.id, p.given_name, p.family_name, p.birth_date, p.metadata
       FROM persons p
       JOIN final_ids r ON p.id = r.id
     `
    // Note: SQL params are $1=rootId, $2=ancestryLimit, $3=progenyLimit
    // This only gets linear relatives. Siblings/Spouses need more.
    // For performance, we fetch core validation first.
    // Getting siblings/spouses in one query is complex.
    // We'll stick to basic implementation: fetch core set, then fetch their relations.

    const result = await client.query(sql, [rootId, ancestryLimit, progenyLimit])
    result.rows.forEach(r => {
      // Convert to Person object
      // we store metadata as jsonb, so retrieving it is automatic
      const meta = r.metadata || {}
      const p = {
        id: r.id,
        data: meta.data || {},
        rels: meta.rels || { parents: [], children: [], spouses: [] }, // This rels is from JSON blob. might be stale if we don't update it?
        // WAIT. If we moved Source of Truth to SQL, we should reconstruct 'rels' from SQL relationships table!
        // But 'metadata.rels' still exists in the JSON column.
        // If we use streaming import, we didn't populate metadata.rels fully (we put empty arrays).
        // So we MUST query relationships table to fill .rels
      }
      loadedPersons.push(p)
    })

    // Populate Relations from SQL
    const loadedIds = loadedPersons.map(p => p.id)
    if (loadedIds.length === 0) return { data: [], config: { mainId: rootId }, meta: {} }

    // Fetch all relationships involving these people
    const relSql = `
       SELECT parent_id, child_id FROM relationships 
       WHERE parent_id = ANY($1) OR child_id = ANY($1)
     `
    const relRes = await client.query(relSql, [loadedIds])

    // Build map
    const personMap = new Map()
    loadedPersons.forEach(p => personMap.set(p.id, p))

    relRes.rows.forEach(row => {
      const parent = personMap.get(row.parent_id)
      const child = personMap.get(row.child_id)

      if (parent) {
        if (!parent.rels.children) parent.rels.children = []
        if (!parent.rels.children.includes(row.child_id)) parent.rels.children.push(row.child_id)
      }
      if (child) {
        if (!child.rels.parents) child.rels.parents = []
        if (!child.rels.parents.includes(row.parent_id)) child.rels.parents.push(row.parent_id)
      }

      // Spouses? If A and B have same child C.
      // We can infer spouses or fetch from logic.
      // For simplicity, we assume if A and B share a child, they are spouses.
      // We can do this in memory.
    })

    // Infer spouses
    const childMap = new Map() // childId -> [parentIds]
    relRes.rows.forEach(row => {
      if (!childMap.has(row.child_id)) childMap.set(row.child_id, [])
      childMap.get(row.child_id).push(row.parent_id)
    })

    childMap.forEach(parents => {
      if (parents.length > 1) {
        // Link all parents as spouses
        for (let i = 0; i < parents.length; i++) {
          for (let j = i + 1; j < parents.length; j++) {
            const p1 = personMap.get(parents[i])
            const p2 = personMap.get(parents[j])
            if (p1 && p2) {
              if (!p1.rels.spouses) p1.rels.spouses = []
              if (!p2.rels.spouses) p2.rels.spouses = []
              if (!p1.rels.spouses.includes(parents[j])) p1.rels.spouses.push(parents[j])
              if (!p2.rels.spouses.includes(parents[i])) p2.rels.spouses.push(parents[i])
            }
          }
        }
      }
    })

    return {
      data: loadedPersons,
      config: { mainId: rootId, ancestryDepth, progenyDepth },
      meta: { source: 'sql-subset' }
    }
  } finally {
    client.release()
  }
}
