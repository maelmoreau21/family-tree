#!/usr/bin/env python3
"""Minimal Flask API backed by the SQLite family database."""

from __future__ import annotations

import importlib.util
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional

from flask import Flask, jsonify, g, request

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT_DIR / "data" / "family.db"
DEFAULT_JSON: Optional[Path] = ROOT_DIR / "data" / "tree.json"
SCHEMA_PATH = ROOT_DIR / "tools" / "sqlite" / "schema.sql"
DATASET_ID = "default"
DEFAULT_SEED_DATASET = {
    "data": [
        {
            "id": "alex-garnier",
            "data": {
                "first name": "Alex",
                "last name": "Garnier",
                "birthday": "1983-03-15",
                "occupation": "Engineer",
            },
            "rels": {
                "spouses": ["lea-roux"],
                "children": ["chloe-garnier", "matteo-garnier", "ines-garnier"],
                "parents": ["pierre-garnier", "julie-garnier"],
            },
        },
        {
            "id": "lea-roux",
            "data": {
                "first name": "Lea",
                "last name": "Roux",
                "birthday": "1984-07-22",
                "occupation": "Architect",
            },
            "rels": {
                "spouses": ["alex-garnier"],
                "children": ["chloe-garnier", "matteo-garnier", "ines-garnier"],
                "parents": [],
            },
        },
        {
            "id": "chloe-garnier",
            "data": {
                "first name": "Chloe",
                "last name": "Garnier",
                "birthday": "2010-02-11",
            },
            "rels": {
                "parents": ["alex-garnier", "lea-roux"],
                "spouses": [],
                "children": [],
            },
        },
        {
            "id": "matteo-garnier",
            "data": {
                "first name": "Matteo",
                "last name": "Garnier",
                "birthday": "2012-06-05",
            },
            "rels": {
                "parents": ["alex-garnier", "lea-roux"],
                "spouses": [],
                "children": [],
            },
        },
        {
            "id": "ines-garnier",
            "data": {
                "first name": "Ines",
                "last name": "Garnier",
                "birthday": "2016-10-19",
            },
            "rels": {
                "parents": ["alex-garnier", "lea-roux"],
                "spouses": [],
                "children": [],
            },
        },
        {
            "id": "pierre-garnier",
            "data": {
                "first name": "Pierre",
                "last name": "Garnier",
                "birthday": "1956-04-30",
            },
            "rels": {
                "spouses": ["julie-garnier"],
                "children": ["alex-garnier"],
                "parents": [],
            },
        },
        {
            "id": "julie-garnier",
            "data": {
                "first name": "Julie",
                "last name": "Garnier",
                "birthday": "1960-12-12",
            },
            "rels": {
                "spouses": ["pierre-garnier"],
                "children": ["alex-garnier"],
                "parents": [],
            },
        },
    ],
    "config": {
        "mainId": "alex-garnier",
        "cardXSpacing": 240,
        "cardYSpacing": 140,
        "orientation": "vertical",
    },
    "meta": {"seeded": True, "source": "default-sqlite"},
}
DB_PATH = Path(os.environ.get("FAMILY_SQLITE_PATH", DEFAULT_DB)).resolve()
JSON_ENV_RAW = os.environ.get("FAMILY_TREE_JSON_PATH")


def resolve_seed_json() -> Optional[Path]:
    if JSON_ENV_RAW:
        candidate = Path(JSON_ENV_RAW).expanduser()
        suffixes = [s.lower() for s in candidate.suffixes]
        if candidate.exists() and (".json" in suffixes or candidate.suffix.lower() == ".json"):
            return candidate.resolve()
    if DEFAULT_JSON is not None and DEFAULT_JSON.exists():
        return DEFAULT_JSON
    return None


def ensure_database() -> None:
    if DB_PATH.exists():
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    seed_json = resolve_seed_json()
    module_path = ROOT_DIR / "tools" / "sqlite" / "migrate_to_sqlite.py"
    if not module_path.exists():
        # Fallback: just create the schema so the API is usable even without data.
        conn = sqlite3.connect(DB_PATH)
        conn.executescript(
            """
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS persons (
              id TEXT PRIMARY KEY,
              given_name TEXT,
              family_name TEXT,
              birth_date TEXT,
              metadata JSON
            );
            CREATE TABLE IF NOT EXISTS relationships (
              parent_id TEXT NOT NULL,
              child_id TEXT NOT NULL,
              PRIMARY KEY (parent_id, child_id)
            );
            """
        )
        conn.close()
        return

    spec = importlib.util.spec_from_file_location("migrate_to_sqlite", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load migration helper at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    args = ["--db", str(DB_PATH), "--with-closure"]
    if seed_json is not None:
        args.extend(["--json", str(seed_json)])

    try:
        module.main(args)
        return
    except Exception as error:  # pragma: no cover - defensive fallback
        print(f"[sqlite-api] Migration helper failed: {error}. Falling back to builtin seed.")

    conn = sqlite3.connect(DB_PATH)
    try:
        try:
            schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            schema_sql = """
            PRAGMA foreign_keys = ON;
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
                PRIMARY KEY (parent_id, child_id)
            );
            CREATE TABLE IF NOT EXISTS closure (
                ancestor_id TEXT NOT NULL,
                descendant_id TEXT NOT NULL,
                depth INTEGER NOT NULL,
                PRIMARY KEY (ancestor_id, descendant_id)
            );
            """
        conn.executescript(schema_sql)
        payload_source = DEFAULT_SEED_DATASET
        if seed_json is not None and Path(seed_json).exists():
            try:
                payload_source = json.loads(Path(seed_json).read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                payload_source = DEFAULT_SEED_DATASET
        payload = json.dumps(payload_source, ensure_ascii=False, separators=(",", ":"))
        if not payload.endswith("\n"):
            payload = f"{payload}\n"
        conn.execute(
            """
            INSERT INTO dataset (id, payload, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (DATASET_ID, payload),
        )
        conn.commit()
    finally:
        conn.close()


ensure_database()

app = Flask(__name__)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db  # type: ignore[return-value]


@app.teardown_appcontext
def close_db(_: Any) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    payload = dict(row)
    metadata = payload.get("metadata")
    if isinstance(metadata, str):
        try:
            payload["metadata"] = json.loads(metadata)
        except json.JSONDecodeError:
            pass
    return payload


@app.route("/person/<string:pid>")
def get_person(pid: str):
    db = get_db()
    person = db.execute("SELECT * FROM persons WHERE id = ?", (pid,)).fetchone()
    if person is None:
        return jsonify({"error": "not found"}), 404

    person_dict = row_to_dict(person)

    parents = db.execute(
        """
        SELECT p.* FROM persons AS p
        JOIN relationships AS r ON p.id = r.parent_id
        WHERE r.child_id = ?
        ORDER BY p.family_name, p.given_name
        """,
        (pid,),
    ).fetchall()

    children = db.execute(
        """
        SELECT p.* FROM persons AS p
        JOIN relationships AS r ON p.id = r.child_id
        WHERE r.parent_id = ?
        ORDER BY p.family_name, p.given_name
        """,
        (pid,),
    ).fetchall()

    metadata = person_dict.get("metadata")
    spouses = []
    if isinstance(metadata, dict):
        raw_spouses = metadata.get("rels", {}).get("spouses")
        if isinstance(raw_spouses, list):
            spouses = raw_spouses

    result = {
        "person": person_dict,
        "parents": [row_to_dict(row) for row in parents],
        "children": [row_to_dict(row) for row in children],
    }

    if spouses:
        result["spouses"] = spouses

    return jsonify(result)


@app.route("/person/<string:pid>/descendants")
def get_descendants(pid: str):
    db = get_db()
    rows = db.execute(
        """
        SELECT p.*, c.depth FROM closure AS c
        JOIN persons AS p ON p.id = c.descendant_id
        WHERE c.ancestor_id = ? AND c.depth > 0
        ORDER BY c.depth, p.family_name, p.given_name
        """,
        (pid,),
    ).fetchall()
    return jsonify([
        {**row_to_dict(row), "depth": row["depth"]} for row in rows
    ])


@app.route("/person/<string:pid>/ancestors")
def get_ancestors(pid: str):
    db = get_db()
    rows = db.execute(
        """
        SELECT p.*, c.depth FROM closure AS c
        JOIN persons AS p ON p.id = c.ancestor_id
        WHERE c.descendant_id = ? AND c.depth > 0
        ORDER BY c.depth, p.family_name, p.given_name
        """,
        (pid,),
    ).fetchall()
    return jsonify([
        {**row_to_dict(row), "depth": row["depth"]} for row in rows
    ])


@app.route("/search")
def search_people():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    like = f"%{query.lower()}%"
    db = get_db()
    rows = db.execute(
        """
        SELECT id, given_name, family_name, birth_date
        FROM persons
        WHERE lower(ifnull(given_name, '')) LIKE ?
           OR lower(ifnull(family_name, '')) LIKE ?
           OR lower(ifnull(metadata, '')) LIKE ?
        ORDER BY family_name, given_name
        LIMIT 25
        """,
        (like, like, like),
    ).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.route("/healthz")
def healthcheck():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
    return jsonify({"status": "ok", "persons": total})


if __name__ == "__main__":  # pragma: no cover
    debug_flag = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    port = int(os.environ.get("FLASK_PORT", "5001"))
    use_reloader = debug_flag and os.environ.get("FLASK_USE_RELOADER", "1").lower() in {"1", "true", "yes"}
    app.run(debug=debug_flag, port=port, use_reloader=use_reloader)
