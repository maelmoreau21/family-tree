import path from 'node:path'
import fs from 'node:fs/promises'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATASET_ID = 'default'
const SCHEMA_VERSION = 1
let dbInstance = null
let ftsEnabled = false
let dropIndexesByDefault = true

function openDatabase(dbPath) {
  if (dbInstance) return dbInstance
  dbInstance = new Database(dbPath)
  // Enable foreign keys and tuned pragmas for better concurrency/performance.
  // WAL mode improves concurrent reads/writes which helps the viewer/builder usage.
  try {
    dbInstance.pragma('foreign_keys = ON')
    dbInstance.pragma('journal_mode = WAL')
    // Use NORMAL synchronous to balance durability and speed for typical desktop/server use.
    dbInstance.pragma('synchronous = NORMAL')
    // Prefer in-memory temp storage and a slightly larger page cache for heavier datasets
    try {
      dbInstance.pragma('temp_store = MEMORY')
      dbInstance.pragma('cache_size = 2000')
    } catch (e) {
      // optional pragmas may fail on some SQLite builds; ignore silently
    }
  } catch (err) {
    // If pragmas are unsupported for any reason, continue with defaults but log.
    console.warn('[db] Unable to apply pragmas:', err && err.message ? err.message : err)
  }
  return dbInstance
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      given_name TEXT,
      family_name TEXT,
      birth_date TEXT,
      metadata TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_persons_given_name ON persons(given_name);
    CREATE INDEX IF NOT EXISTS idx_persons_family_name ON persons(family_name);
  CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(family_name, given_name);
  CREATE INDEX IF NOT EXISTS idx_dataset_updated_at ON dataset(updated_at);
    CREATE TABLE IF NOT EXISTS relationships (
      parent_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      PRIMARY KEY (parent_id, child_id),
      FOREIGN KEY (parent_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES persons(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS closure (
      ancestor_id TEXT NOT NULL,
      descendant_id TEXT NOT NULL,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id),
      FOREIGN KEY (ancestor_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (descendant_id) REFERENCES persons(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_relationships_parent ON relationships(parent_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_child ON relationships(child_id);
    CREATE INDEX IF NOT EXISTS idx_closure_ancestor ON closure(ancestor_id);
    CREATE INDEX IF NOT EXISTS idx_closure_descendant ON closure(descendant_id);
  `)

  // Best-effort: create an FTS5 virtual table for fast text search.
  // Not all SQLite builds include FTS5, so wrap in try/catch and fall back silently.
  try {
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(id, given_name, family_name, metadata)")
    ftsEnabled = true
  } catch (e) {
    ftsEnabled = false
  }

  // Additional helpful indexes for large datasets: timestamps
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_persons_updated_at ON persons(updated_at)')
  } catch (e) {
    // ignore failures for older sqlite builds
  }
}

function applyMigrations(db) {
  const row = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('schema_version')
  let currentVersion = row ? Number.parseInt(row.value, 10) || 0 : 0

  const setVersion = (version) => {
    db.prepare(`INSERT INTO schema_meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(version))
  }

  if (currentVersion === 0) {
    currentVersion = SCHEMA_VERSION
    setVersion(currentVersion)
    return
  }

  if (currentVersion === SCHEMA_VERSION) {
    return
  }

  if (currentVersion > SCHEMA_VERSION) {
    return
  }

  // Placeholder for future migrations when SCHEMA_VERSION increases.
  currentVersion = SCHEMA_VERSION
  setVersion(currentVersion)
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
  const metadata = JSON.stringify({ data, rels, extras })
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

function rebuildRelationalTables(db, payload, options = {}) {
  const { data } = normalisePayload(payload)
  const { dropIndexes = dropIndexesByDefault, fastImport = false } = options
  // Attempt to drop non-essential indexes to speed up large imports. We'll recreate them after inserts.
  let droppedIndexes = false
  // If fastImport is requested, temporarily relax synchronous setting to speed inserts.
  let originalSynchronous = null
  if (fastImport) {
    try {
      // read current value if possible
      try { originalSynchronous = db.pragma('synchronous', { simple: true }) } catch (e) { originalSynchronous = null }
      db.pragma('synchronous = OFF')
      // try to set a reasonable WAL auto-checkpoint to avoid unbounded WAL growth
      try { db.pragma('wal_autocheckpoint = 1000') } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }
  if (dropIndexes) {
    try {
      db.exec('DROP INDEX IF EXISTS idx_persons_given_name')
      db.exec('DROP INDEX IF EXISTS idx_persons_family_name')
      db.exec('DROP INDEX IF EXISTS idx_persons_name')
      droppedIndexes = true
    } catch (e) {
      // ignore failures; proceed without dropping
      droppedIndexes = false
    }
  }

  const ftsRecords = []
  const insertPerson = db.prepare(`
    INSERT OR REPLACE INTO persons (id, given_name, family_name, birth_date, metadata, created_at, updated_at)
    VALUES (@id, @givenName, @familyName, @birthDate, @metadata, @createdAt, @updatedAt)
  `)
  const insertRelationship = db.prepare(
    'INSERT OR IGNORE INTO relationships (parent_id, child_id) VALUES (?, ?)' )

  const clearPersons = db.prepare('DELETE FROM persons')
  const clearRels = db.prepare('DELETE FROM relationships')
  const clearClosure = db.prepare('DELETE FROM closure')

  clearPersons.run()
  clearRels.run()
  clearClosure.run()

  const knownIds = new Set()
  const pendingPairs = []
  data.forEach(person => {
    const record = toPersonRecord(person)
    if (!record) return
    // populate timestamp fields during rebuild
    const ts = new Date().toISOString()
    const recWithTs = { ...record, createdAt: ts, updatedAt: ts }
    insertPerson.run(recWithTs)
    if (ftsEnabled) ftsRecords.push(recWithTs)
    knownIds.add(record.id)
    const pairs = collectRelationshipPairs(person, record.id)
    pairs.forEach(pair => pendingPairs.push(pair))
  })

  const seenPairs = new Set()
  pendingPairs.forEach(([parent, child]) => {
    if (!parent || !child) return
    if (!knownIds.has(parent) || !knownIds.has(child)) return
    const key = `${parent}→${child}`
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    insertRelationship.run(parent, child)
  })

  db.prepare('INSERT INTO closure (ancestor_id, descendant_id, depth) SELECT id, id, 0 FROM persons').run()
  db.prepare(`
    WITH RECURSIVE tree(ancestor_id, descendant_id, depth) AS (
      SELECT parent_id, child_id, 1 FROM relationships
      UNION
      SELECT t.ancestor_id, r.child_id, t.depth + 1
      FROM tree AS t
      JOIN relationships AS r ON r.parent_id = t.descendant_id
    )
    INSERT OR IGNORE INTO closure (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, descendant_id, depth FROM tree
  `).run()

  // Populate FTS table if available
  if (ftsEnabled) {
    try {
      db.prepare('DELETE FROM persons_fts').run()
      const insertFts = db.prepare('INSERT INTO persons_fts (id, given_name, family_name, metadata) VALUES (?, ?, ?, ?)')
      for (const r of ftsRecords) {
        insertFts.run(r.id, r.givenName, r.familyName, r.metadata)
      }
    } catch (e) {
      // If FTS operations fail, disable for this run but continue
      console.warn('[db] FTS update failed:', e && e.message ? e.message : e)
      ftsEnabled = false
    }
  }

  // Recreate dropped indexes
  if (droppedIndexes) {
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_persons_given_name ON persons(given_name)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_persons_family_name ON persons(family_name)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(family_name, given_name)')
      // Ensure timestamp indexes exist after import
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_persons_updated_at ON persons(updated_at)')
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.warn('[db] Failed to recreate indexes:', e && e.message ? e.message : e)
    }
  }

  // Restore synchronous pragma if we modified it
  if (fastImport) {
    try {
      if (originalSynchronous !== null && originalSynchronous !== undefined) db.pragma(`synchronous = ${String(originalSynchronous)}`)
      else db.pragma('synchronous = NORMAL')
    } catch (e) {
      // ignore
    }
  }
}

export function initialiseDatabase(dbPath, seedLoader) {
  const db = openDatabase(dbPath)
  ensureSchema(db)
  applyMigrations(db)
  const row = db.prepare('SELECT payload FROM dataset WHERE id = ?').get(DATASET_ID)
  if (!row) {
    const fallback = seedLoader ? seedLoader() : { data: [], config: {}, meta: {} }
    setTreePayload(dbPath, fallback)
  }
  return db
}

export function getTreePayload(dbPath) {
  const db = openDatabase(dbPath)
  const row = db.prepare('SELECT payload FROM dataset WHERE id = ?').get(DATASET_ID)
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

export function setTreePayload(dbPath, payload, serialiser, options) {
  const db = openDatabase(dbPath)
  const normalised = normalisePayload(payload)
  const stringPayload = typeof payload === 'string'
    ? payload
    : serialiser
      ? serialiser(payload)
      : JSON.stringify(payload)
  const timestamp = new Date().toISOString()
  const save = db.prepare(`
    INSERT INTO dataset (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `)
  const tx = db.transaction(() => {
    save.run(DATASET_ID, stringPayload, timestamp)
    rebuildRelationalTables(db, payload, options)
  })
  tx()
  return normalised
}

export function getLastUpdatedAt(dbPath) {
  const db = openDatabase(dbPath)
  const row = db.prepare('SELECT updated_at FROM dataset WHERE id = ?').get(DATASET_ID)
  return row ? row.updated_at : null
}

export function rebuildFts(dbPath) {
  const db = openDatabase(dbPath)
  if (!ftsEnabled) {
    throw new Error('FTS not enabled in this SQLite build')
  }
  try {
    db.prepare('DELETE FROM persons_fts').run()
    const insertFts = db.prepare('INSERT INTO persons_fts (id, given_name, family_name, metadata) VALUES (?, ?, ?, ?)')
    const rows = db.prepare('SELECT id, given_name, family_name, metadata FROM persons').all()
    for (const r of rows) insertFts.run(r.id, r.given_name, r.family_name, r.metadata)
    return { ok: true, inserted: rows.length }
  } catch (e) {
    console.warn('[db] rebuildFts failed', e && e.message ? e.message : e)
    throw e
  }
}

export function resetToSeed(dbPath, seedPayload) {
  // Overwrites dataset with provided seedPayload. Use with caution.
  return setTreePayload(dbPath, seedPayload)
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
