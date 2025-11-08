# SQLite migration toolkit

This directory contains a minimal toolkit to migrate the existing `tree.json` dataset into
SQLite, together with a lightweight Flask API for local experiments.

## Contents

- `schema.sql` – canonical schema (persons, relationships, optional closure table).
- `migrate_to_sqlite.py` – converts `data/tree.json` into a SQLite database (also used automatically by the API if the DB is missing).
- `api.py` – small Flask service that exposes the imported data and auto-creates `family.db` when needed.
- `requirements.txt` – Python dependencies needed for the scripts.

## Quick start

```powershell
# 1. Install dependencies (prefer a virtual environment)
python -m venv .venv
.\.venv\Scripts\activate
pip install -r tools\sqlite\requirements.txt

# 2. Run the migration (creates data\family.db by default)
python tools\sqlite\migrate_to_sqlite.py --reset --with-closure

# 3. Start the API
python tools\sqlite\api.py
```

### Docker image

The repository also ships a lightweight Docker image:

```powershell
docker build -f tools/sqlite/Dockerfile -t family-tree-sqlite .
docker run --rm -p 5001:5001 -v ${PWD}\data:/data family-tree-sqlite
```

On first boot the container seeds `/data/family.db` from `/data/tree.json` (or the sample bundled inside the image) and exposes the same endpoints as the local server.

Arguments of the migration script:

- `--json` – path to the source JSON file (defaults to `data/tree.json`).
- `--db` – destination SQLite path (defaults to `data/family.db`).
- `--reset` – clears existing rows before importing.
- `--with-closure` – populates the `closure` table to speed up ancestor/descendant queries.

The API reads the database path from the `FAMILY_SQLITE_PATH` environment variable if set; otherwise it falls back to `data/family.db`. Endpoints exposed:

- `GET /person/<id>` – person details with parents and children.
- `GET /person/<id>/descendants` – descendants (requires `closure`).
- `GET /person/<id>/ancestors` – ancestors (requires `closure`).
- `GET /search?q=` – simple substring search across names and metadata.
- `GET /healthz` – health probe returning total persons imported.

## Next steps

- Point the existing frontend/server at the Flask endpoints instead of reading the JSON file directly.
- If you move to PostgreSQL later, replicate the schema and reuse the API logic with `psycopg`.
- Automate migrations with Alembic or sqlite-utils once the schema stabilises.
