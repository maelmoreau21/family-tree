# Family Tree

![Family Tree logo](examples/logo.svg)

Family Tree is a polished fork of **family-chart**. It couples an ES module library (dist build + typings) with two ready-to-ship web apps: a **viewer** and a **builder**. The apps share the same REST API, so you can explore and edit the same JSON dataset from either side.

## Highlights

- 🌳 Interactive viewer with zoom, pan, breadcrumbs, history, and live branch statistics
- 🧑‍🎨 Visual builder (FR) featuring live preview, undo/redo, image uploads, and auto-save
- 🃏 HTML & SVG card renderers with configurable layouts, styles, and mini-tree mode
- 🧭 Progressive loading: fetch only the current branch (`/api/tree?mode=subtree`), ideal for large datasets
- 🧰 First-class TypeScript support (`dist/types` + ES exports) for integrating the chart in your own apps
- 🚀 Production-friendly packaging: pre-built ES modules, esbuild-bundled viewer/builder, Docker image, and import-map CDN fallback when bundles are missing

## Project Layout

```text
├─ dist/                 # Published library (ESM, CJS, types, styles)
├─ server/               # Express server powering viewer + builder + uploads
├─ static/               # Viewer & builder entrypoints (bundled + fallback ES modules)
├─ data/family.db        # Primary SQLite dataset (auto-created on first run)
├─ uploads/              # User-uploaded avatars (mount this in production)
├─ scripts/compact-tree.mjs  # Utility to compact/export datasets from SQLite
└─ docs/                 # Additional documentation (FR)
```

## Getting Started (Node.js)

Requirements: **Node.js 20+** and **npm 10+**.

```powershell
# install dependencies
npm install

# build library + viewer/builder bundles
npm run build

# start the dual-port server (viewer + builder)

```

- Viewer: `http://localhost:7920`
- Builder: `http://localhost:7921`
- Default dataset: `data/family.db` (override with `TREE_DB_PATH`, legacy `TREE_DATA_PATH` is still recognised)
- Optional SQLite API: `tools/sqlite/api.py` (creates the SQLite file and optional JSON seed on first run)

Hot module reloading during development is available through Vite:

```powershell
npm run dev
```

The dev server proxies API calls to the Express backend and reloads the static apps automatically.

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Cleans `dist`, runs Rollup for the library, bundles viewer/builder with esbuild |
| `npm start` | Launches the production Express server (reads env vars listed below) |
| `npm run dev` | Starts Vite for local development with live reload |
| `npm run test` / `npm run test-run` | Open or run the Cypress end-to-end suite |
| `npm run data:compact` | Rewrites the SQLite dataset (`TREE_DB_PATH`) and exports a compact JSON snapshot |

> `scripts/compact-tree.mjs` accepts `TREE_DB_PATH` (or legacy `TREE_DATA_PATH`), `TREE_DATA_PRETTY`, and `TREE_BACKUP_DIR`. Use it when you want to shrink or prettify datasets prior to versioning.

## Configuration (Environment Variables)

| Variable | Default | Notes |
| --- | --- | --- |
| `VIEWER_PORT` | `7920` | HTTP port for the read-only viewer |
| `BUILDER_PORT` | `7921` | HTTP port for the builder UI |
| `TREE_DB_PATH` | `<repo>/data/family.db` | Primary SQLite database used by the server |
| `TREE_DATA_PATH` | Same as above (legacy name) | Backwards-compatible alias for `TREE_DB_PATH` |
| `FAMILY_SQLITE_PATH` | `<repo>/data/family.db` | SQLite path used by the optional Flask API |
| `FAMILY_TREE_JSON_PATH` | _(unset)_ | Optional JSON seed consumed by the Flask API if provided |
| `TREE_SEED_JSON` | _(unset)_ | Optional JSON seed used by the Node server on first run |
| `TREE_DATA_DIR` | Directory of `TREE_DB_PATH` | Where backups are stored |
| `TREE_BACKUP_LIMIT` | `50` | Rolling number of backups to keep |
| `TREE_BACKUP_DIR` | `<data-dir>/backups` | Override to store snapshots elsewhere |
| `TREE_DATA_PRETTY` | `false` | Pretty-print JSON when saving (set to `1` to enable) |
| `TREE_PAYLOAD_LIMIT` | `25mb` | Maximum request body accepted by `PUT /api/tree` |
| `NODE_ENV` | `development` / `production` | Controls cache headers & logging |

> Avatar uploads are capped at 5 MB. Adjust `MAX_UPLOAD_SIZE` in `server/index.js` if you need a different limit.

Backups are available through:

- `GET /api/backups` → metadata list
- `GET /api/backups/:filename` → raw download

## Data Format in a Nutshell

The builder saves a JSON envelope containing both the dataset and chart preferences:

```json
{
  "data": [
    {
      "id": "alex-garnier",
      "data": {
        "first name": "Alex",
        "last name": "Garnier",
        "gender": "M"
      },
      "rels": {
        "spouses": ["lea-roux"],
        "children": ["chloe-garnier", "matteo-garnier", "ines-garnier"],
        "parents": ["pierre-garnier", "julie-garnier"]
      }
    }
  ],
  "config": {
    "mainId": "alex-garnier",
    "cardXSpacing": 240,
    "cardYSpacing": 140,
    "orientation": "vertical",
    "miniTree": true
  }
}
```

Legacy “array-only” payloads are still accepted. The next save wraps them into the envelope automatically. See `docs/data-format.md` for the full schema (parents / spouses / children rules, legacy aliases, custom fields, etc.).

## Dataset Maintenance

- **Import a JSON snapshot into SQLite (Docker)**

  ```powershell
  docker compose exec family-tree python /app/tools/sqlite/migrate_to_sqlite.py --db /data/family.db --json /data/import.json --reset --with-closure
  ```

- **Compact the active dataset**

  ```powershell
  docker compose exec family-tree node /app/scripts/compact-tree.mjs
  ```

- **Pretty-print on next save**: start the server with `TREE_DATA_PRETTY=1` (locally or in Docker) to store a prettified JSON payload inside the database and backups.

### Checking for Duplicates

The viewer automatically annotates duplicated persons (same `id`). To verify a dataset before publishing:

```powershell
node -e "(async () => { const { resolve } = await import('node:path'); const lib = await import('file://' + resolve('dist/family-tree.esm.js')); const db = await import('./server/db.js'); const dbPath = process.env.TREE_DB_PATH ?? process.env.TREE_DATA_PATH ?? 'data/family.db'; db.initialiseDatabase(dbPath); const payload = db.getTreePayload(dbPath); const tree = lib.calculateTree(payload.data ?? payload, { main_id: payload.config?.mainId, duplicate_branch_toggle: true }); console.log('duplicates', tree.data.filter(d => d.duplicate).map(d => d.data.id)); })().catch(err => { console.error(err); process.exit(1); });"
```

An empty array means your IDs are unique.

## Static Assets & Bundles

- `static/viewer/viewer.bundle.js` and `static/builder/builder.bundle.js` are the production bundles generated by esbuild.
- The corresponding HTML files include an **import map** and a **fallback loader**. If the bundle is missing (e.g. during local hacking), the apps load their unbundled `viewer.js` / `builder.js` modules directly.
- The import map pins D3 submodules to ES CDN URLs, so the fallback path works even without a build step.

## Docker

```powershell
$dataDir    = "C:\\path\\to\\tree-data"
$uploadsDir = "C:\\path\\to\\tree-uploads"

docker build -t family-tree .
docker run `
  --rm `
  -p 7920:7920 `
  -p 7921:7921 `
  -e TREE_DB_PATH=/data/family.db `
  -e VIEWER_PORT=7920 `
  -e BUILDER_PORT=7921 `
  -v ${dataDir}:/data `
  -v ${uploadsDir}:/app/uploads `
  family-tree
```

- The image initialises `/data/family.db` if absent and keeps rolling backups in `/data/backups`.
- Mount `/app/uploads` to persist pictures uploaded via the builder.
- Tune `TREE_PAYLOAD_LIMIT` for very large trees.

### Optional SQLite API container

To expose the SQLite snapshot through Flask (useful for integrating with other services), spin up the dedicated container:

```powershell
docker build -f tools/sqlite/Dockerfile -t family-tree-sqlite .
docker run `
  --rm `
  -p 5001:5001 `
  -v ${dataDir}:/data `
  family-tree-sqlite
```

The API auto-creates `/data/family.db` (importing from `FAMILY_TREE_JSON_PATH` when provided) and exposes endpoints at `http://localhost:5001`.

### Docker Compose (Windows PowerShell)

```powershell
$env:TREE_DATA_DIR = "C:\\path\\to\\tree-data"
docker compose up --build -d
```

Default mounts:

- `./data` → `/data`
- `./uploads` → `/app/uploads`
- `./data` → `/data` (for the SQLite API service)

Once both services are up, the Express backend remains available on ports `7920/7921` and the SQLite API responds on `5001`.

### Multi-Architecture Builds

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t family-tree:latest .
```

## API Surface

| Method & Path | Description |
| --- | --- |
| `GET /api/tree` | Returns the full dataset or the configured branch (`mode=subtree`) |
| `PUT /api/tree` | Persists changes (with optional pretty-print + backups) |
| `GET /api/tree/summary` | Lightweight index for search/autocomplete |
| `GET /api/backups` | Lists saved snapshots |
| `GET /api/backups/:file` | Downloads a backup |
| `POST /api/uploads` | Uploads an image (5 MB limit, JPEG/PNG/WebP/GIF/SVG) |

## Troubleshooting

- **White screen after pulling?** Run `npm run build` to regenerate bundles. The HTML fallback will also work in a pinch.
- **Slow tree rendering?** Reduce `cardXSpacing`, limit depth from the controls, or use search to recenter the main profile.
- **Large JSON files?** Run `npm run data:compact` or set `TREE_DATA_PRETTY=0` to keep the file minified. Adjust `TREE_BACKUP_LIMIT` if backups consume too much disk.
- **Uploads failing?** Check disk space on the `/app/uploads` volume, ensure the request stays under 5 MB, and inspect server logs for Multer errors.

## Documentation

- [Installation & Quickstart (FR)](docs/installation-and-quickstart.md)
- [Data Format Reference](docs/data-format.md)
- [Original project (family-chart)](https://github.com/donatso/family-chart)

## License

Distributed under the MIT License — see `LICENSE.txt`.
