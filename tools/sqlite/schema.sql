PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  given_name TEXT,
  family_name TEXT,
  birth_date TEXT,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS dataset (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationships (
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  PRIMARY KEY (parent_id, child_id),
  FOREIGN KEY (parent_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES persons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relationships_parent ON relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_relationships_child ON relationships(child_id);

CREATE TABLE IF NOT EXISTS closure (
  ancestor_id TEXT NOT NULL,
  descendant_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  FOREIGN KEY (ancestor_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY (descendant_id) REFERENCES persons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_closure_ancestor ON closure(ancestor_id);
CREATE INDEX IF NOT EXISTS idx_closure_descendant ON closure(descendant_id);
