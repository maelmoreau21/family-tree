import path from 'node:path'
import fs from 'node:fs/promises'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATASET_ID = 'default'
let dbInstance = null

function openDatabase(dbPath) {
  if (dbInstance) return dbInstance
  dbInstance = new Database(dbPath)
  dbInstance.pragma('foreign_keys = ON')
  return dbInstance
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      given_name TEXT,
      family_name TEXT,
      birth_date TEXT,
      metadata TEXT
    );
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

function rebuildRelationalTables(db, payload) {
  const { data } = normalisePayload(payload)
  const insertPerson = db.prepare(`
    INSERT OR REPLACE INTO persons (id, given_name, family_name, birth_date, metadata)
    VALUES (@id, @givenName, @familyName, @birthDate, @metadata)
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
    insertPerson.run(record)
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
}

export function initialiseDatabase(dbPath, seedLoader) {
  const db = openDatabase(dbPath)
  ensureSchema(db)
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

export function setTreePayload(dbPath, payload, serialiser) {
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
    rebuildRelationalTables(db, payload)
  })
  tx()
  return normalised
}

export function getLastUpdatedAt(dbPath) {
  const db = openDatabase(dbPath)
  const row = db.prepare('SELECT updated_at FROM dataset WHERE id = ?').get(DATASET_ID)
  return row ? row.updated_at : null
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}