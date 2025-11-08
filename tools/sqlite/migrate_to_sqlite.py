#!/usr/bin/env python3
"""Convert a family-tree JSON export into a SQLite database."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Set, Tuple

try:
    import ijson  # type: ignore
except ImportError:  # pragma: no cover - fallback for environments without ijson
    ijson = None  # type: ignore

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_JSON = ROOT_DIR / "data" / "tree.json"
DEFAULT_DB = ROOT_DIR / "data" / "family.db"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")
DATASET_ID = "default"

Person = Dict[str, object]
RelationPair = Tuple[str, str]


def load_schema() -> str:
    return SCHEMA_PATH.read_text(encoding="utf-8")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(load_schema())


def clear_database(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("DELETE FROM closure")
    cursor.execute("DELETE FROM relationships")
    cursor.execute("DELETE FROM persons")
    cursor.execute("DELETE FROM dataset")
    conn.commit()


def iter_persons(json_path: Path) -> Iterator[Person]:
    if ijson is None:
        data = json.loads(json_path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            for person in data:
                if isinstance(person, dict):
                    yield person
            return
        persons = data.get("data") if isinstance(data, dict) else []
        if isinstance(persons, list):
            for person in persons:
                if isinstance(person, dict):
                    yield person
        return

    with json_path.open("rb") as handle:
        try:
            yield from (item for item in ijson.items(handle, "data.item") if isinstance(item, dict))
            return
        except Exception:  # fallback when top-level key differs
            handle.seek(0)
        yield from (item for item in ijson.items(handle, "item") if isinstance(item, dict))


def normalise_identifier(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, dict):
        for key in ("id", "value", "personId", "person_id"):
            if key in value and value[key] is not None:
                return normalise_identifier(value[key])
        return None
    text = str(value).strip()
    return text or None


def extract_person_record(person: Person) -> Tuple[str, Optional[str], Optional[str], Optional[str], str]:
    person_id = normalise_identifier(person.get("id"))
    if not person_id:
        raise ValueError("Encountered person without an id")

    raw_data = person.get("data")
    fields = raw_data if isinstance(raw_data, dict) else {}

    given_name = fields.get("first name") if isinstance(fields.get("first name"), str) else None
    family_name = fields.get("last name") if isinstance(fields.get("last name"), str) else None
    birth_date = fields.get("birthday") if isinstance(fields.get("birthday"), str) else None

    metadata_source = {k: v for k, v in fields.items() if k not in {"first name", "last name", "birthday"}}
    rels = person.get("rels") if isinstance(person.get("rels"), dict) else {}
    extras = {k: v for k, v in person.items() if k not in {"id", "data", "rels"}}

    metadata = {
        "data": metadata_source,
        "rels": rels,
        "extras": extras,
    }

    metadata_json = json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
    return person_id, given_name, family_name, birth_date, metadata_json


def collect_relationships(person: Person, person_id: str) -> Set[RelationPair]:
    rels = person.get("rels") if isinstance(person.get("rels"), dict) else {}
    pairs: Set[RelationPair] = set()

    parents = rels.get("parents") if isinstance(rels.get("parents"), Sequence) else []
    for raw_parent in parents:
        parent_id = normalise_identifier(raw_parent)
        if parent_id:
            pairs.add((parent_id, person_id))

    children = rels.get("children") if isinstance(rels.get("children"), Sequence) else []
    for raw_child in children:
        child_id = normalise_identifier(raw_child)
        if child_id:
            pairs.add((person_id, child_id))

    return pairs


def store_dataset(conn: sqlite3.Connection, payload_string: str) -> None:
    payload = payload_string if payload_string.endswith("\n") else f"{payload_string}\n"
    conn.execute(
        """
        INSERT INTO dataset (id, payload, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        """,
        (DATASET_ID, payload),
    )
    conn.commit()


def insert_persons(conn: sqlite3.Connection, persons: Iterable[Person]) -> Tuple[int, Set[str], Set[RelationPair]]:
    cursor = conn.cursor()
    inserted = 0
    person_ids: Set[str] = set()
    pairs: Set[RelationPair] = set()

    for person in persons:
        record = extract_person_record(person)
        person_id = record[0]
        cursor.execute(
            """
            INSERT OR REPLACE INTO persons (id, given_name, family_name, birth_date, metadata)
            VALUES (?, ?, ?, ?, ?)
            """,
            record,
        )
        person_ids.add(person_id)
        pairs.update(collect_relationships(person, person_id))
        inserted += 1
        if inserted % 1000 == 0:
            conn.commit()
    conn.commit()
    return inserted, person_ids, pairs


def insert_relationships(conn: sqlite3.Connection, pairs: Set[RelationPair], person_ids: Set[str]) -> Tuple[int, Set[str]]:
    cursor = conn.cursor()
    missing_children: Set[str] = set()
    inserted = 0

    for parent_id, child_id in sorted(pairs):
        if parent_id not in person_ids or child_id not in person_ids:
            if child_id not in person_ids:
                missing_children.add(child_id)
            continue
        cursor.execute(
            """
            INSERT OR IGNORE INTO relationships (parent_id, child_id) VALUES (?, ?)
            """,
            (parent_id, child_id),
        )
        if cursor.rowcount:
            inserted += 1
    conn.commit()
    return inserted, missing_children


def rebuild_closure(conn: sqlite3.Connection) -> int:
    cursor = conn.cursor()
    cursor.execute("DELETE FROM closure")
    cursor.execute(
        "INSERT INTO closure (ancestor_id, descendant_id, depth) SELECT id, id, 0 FROM persons"
    )
    cursor.execute(
        """
        WITH RECURSIVE tree(ancestor_id, descendant_id, depth) AS (
          SELECT parent_id, child_id, 1 FROM relationships
          UNION
          SELECT t.ancestor_id, r.child_id, t.depth + 1
          FROM tree AS t
          JOIN relationships AS r ON r.parent_id = t.descendant_id
        )
        INSERT OR IGNORE INTO closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, descendant_id, depth FROM tree
        """
    )
    conn.commit()
    count = cursor.execute("SELECT COUNT(*) FROM closure").fetchone()[0]
    return int(count)


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate tree.json into a SQLite database.")
    parser.add_argument("--json", default=str(DEFAULT_JSON), help="Path to the tree JSON file.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="Destination SQLite database path.")
    parser.add_argument(
        "--with-closure",
        action="store_true",
        help="Populate the closure table for ancestor/descendant lookups.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear existing rows before importing (keeps the database file).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> None:
    args = parse_args(argv)
    json_path = Path(args.json).expanduser().resolve()
    db_path = Path(args.db).expanduser().resolve()

    if not json_path.exists():
        raise SystemExit(f"JSON source not found: {json_path}")

    raw_payload = json_path.read_text(encoding="utf-8")
    try:
        parsed_payload = json.loads(raw_payload)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON payload: {error}") from error

    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    try:
        ensure_schema(conn)
        if args.reset:
            clear_database(conn)
        inserted_persons, person_ids, pairs = insert_persons(conn, iter_persons(json_path))
        inserted_relationships, missing = insert_relationships(conn, pairs, person_ids)
        closure_rows = 0
        if args.with_closure:
            closure_rows = rebuild_closure(conn)

        payload_string = json.dumps(parsed_payload, ensure_ascii=False, separators=(",", ":"))
        store_dataset(conn, payload_string)
    finally:
        conn.close()

    print(f"Imported {inserted_persons} persons into {db_path}")
    print(f"Stored {inserted_relationships} parent-child relationships")
    if args.with_closure:
        print(f"Closure rows computed: {closure_rows}")
    if missing:
        preview = ", ".join(sorted(missing)[:10])
        print(f"Warning: {len(missing)} relationships skipped because child ids were missing ({preview}...)" )


if __name__ == "__main__":  # pragma: no cover
    main(sys.argv[1:])
