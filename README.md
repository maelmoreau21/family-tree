# Family Tree

![Family Tree logo](examples/logo.svg)

Family Tree is a D3.js based visualization library for building rich, interactive family trees. Forked from Family Chart, it ships with a bilingual builder UI, TypeScript typings, and ready-to-use HTML/SVG card renderers so you can focus on your data instead of layout plumbing.

## Features

- 🌳 Interactive tree navigation with zoom, pan, and history controls
- 🧩 HTML & SVG card renderers with configurable layouts and image slots
- 🛠️ Visual builder (FR) with live preview, auto-save, and undo/redo
- 🖼️ Integrated image uploads: drag-and-drop, auto-apply to profiles, served from `/uploads`
- ⚙️ Layout tuning: orientation, spacing, siblings visibility, custom sorters

## Web Interfaces

- `http://localhost:7920` → viewer (read-only): zoom, navigation, selection, info panel.
- `http://localhost:7921` → builder (edition): editable fields, card display, spacing/style, auto-save.
- Both screens consume the same REST API (`GET/PUT /api/tree`) and read/write a single shared JSON file.

## Getting Started (Node.js)

```powershell
# from the project root
npm install
npm run build
npm start
```

The dev server exposes the viewer on `http://localhost:7920` and the builder on `http://localhost:7921`. Data is stored in `<repo>/data/tree.json` by default; override `TREE_DATA_PATH` to target another file or mount a different folder.

### Persistent Storage & Backups

- `TREE_DATA_PATH` points to the live JSON file written by the builder (defaults to `/data/tree.json`).
- `TREE_DATA_DIR` overrides the folder where data is stored (defaults to the directory of `TREE_DATA_PATH`).
- Every successful save now drops a timestamped snapshot in `<data-dir>/backups`. Limit the rolling history with `TREE_BACKUP_LIMIT` (default: 50 files) or change the folder via `TREE_BACKUP_DIR`.
- `TREE_PAYLOAD_LIMIT` controls the maximum request size accepted when saving (default: `25mb`). Bump it if your tree exceeds that size.
- Snapshots are exposed over `/api/backups` (JSON list) and `/api/backups/<filename>` (raw download) so you can script exports or restore points.
- Uploaded media is stored in `<repo>/uploads` (or `/app/uploads` inside Docker) and served from `/uploads/<filename>`. Mount that directory in production to keep assets across restarts.

### Image Uploads

- The builder’s **Images** panel now streams files to `POST /api/uploads` (5 MB limit, JPEG/PNG/WebP/GIF/SVG).
- When you upload or paste an URL while editing a profile, the active image field is filled automatically and the card preview refreshes immediately.
- The same uploader is available from the edit modal, so you can manage media without leaving the profile.
- Clean up orphan files by pruning `<repo>/uploads` (or your mounted volume) as needed; the builder simply stores the absolute URL in the person data.

### Large Trees & Performance

- Viewer & builder now load in **compact mode**: mini cards, 4 générations d’ancêtres/descendants visibles et fusion automatique des branches dupliquées. Ces réglages sont sauvegardés dans `config`.
- Ajustez la profondeur affichée ou désactivez les cartes compactes grâce aux nouveaux sélecteurs (panneau “Options de mise en page” dans le builder, encart “Affichage rapide” dans le viewer). Passez à “Illimité” pour tout montrer, ou réduisez la profondeur pour garder un rendu fluide au-delà de 2 000 profils.
- Pour optimiser les très gros arbres (>5 000 profils) :
  - réduisez les espacements (`cardXSpacing` / `cardYSpacing`) et laissez Mini Tree activé ;
  - travaillez branche par branche via la recherche (le tree se recalcule autour du profil principal) ;
  - ajustez `TREE_PAYLOAD_LIMIT` si vos sauvegardes dépassent la taille par défaut.
- Le viewer affiche en direct le nombre de cartes visibles vs profils totaux pour vous aider à dimensionner l’affichage avant d’exporter/prendre une capture.
- Le serveur découpe désormais automatiquement l’arbre : le viewer charge une branche locale (profondeurs ancêtres/descendants configurées) puis recharge dès que vous changez de profil principal ou de profondeur.
- L’API `/api/tree` accepte `mode=subtree`, `mainId`, `ancestryDepth`, `progenyDepth`, `includeSiblings`, `includeSpouses` et renvoie un bloc `meta` (`total`, `returned`, profondeurs appliquées) pour suivre la taille de la branche.
- Pour la recherche globale sans rapatrier tout le JSON, utilisez `/api/tree/summary` : l’endpoint renvoie `{ total, updatedAt, mainId, persons[] }` avec les noms/infos clés nécessaires à l’autocomplétion.

## Docker

```powershell
$dataDir   = "C:\\path\\to\\tree-data"
$uploadsDir = "C:\\path\\to\\tree-uploads"
docker build -t family-tree .
docker run `
  --rm `
  -p 7920:7920 `
  -p 7921:7921 `
  -e TREE_DATA_PATH=/data/tree.json `
  -e VIEWER_PORT=7920 `
  -e BUILDER_PORT=7921 `
  -v ${dataDir}:/data `
  -v ${uploadsDir}:/app/uploads `
  family-tree
```

- The container creates `/data/tree.json` if it does not exist (seeded with sample data) and stores rolling backups under `/data/backups`; mount a folder, not a single file.
- Mount `/app/uploads` to persist pictures dropped through the builder uploader.
- Override `VIEWER_PORT` and `BUILDER_PORT` to publish alternate ports.
- For very large datasets, adjust `TREE_PAYLOAD_LIMIT` (save size ceiling) or mount a faster disk via the `/data` volume.

### Docker Compose (Windows PowerShell)

```powershell
$env:TREE_DATA_DIR = "C:\path\to\tree-data"
docker compose up --build
```

> The default `docker-compose.yml` binds `./data` to `/data` and `./uploads` to `/app/uploads` so assets and backups survive restarts. Adjust those paths if you keep data elsewhere.

### ARM64 (Raspberry Pi)

```bash
docker buildx build --platform linux/arm64 -t family-tree:arm64 .
docker run -p 7920:7920 -p 7921:7921 -v /path/to/my-tree.json:/data/tree.json family-tree:arm64
```

## Data File Structure

Both interfaces understand the legacy **array-only** format and the new **object envelope**. The builder now saves layout preferences alongside the payload:

```json
{
  "config": {
    "transitionTime": 250,
    "cardXSpacing": 240,
    "cardYSpacing": 160,
    "orientation": "vertical",
    "showSiblingsOfMain": true,
    "singleParentEmptyCard": true,
    "singleParentEmptyCardLabel": "Unknown",
    "editableFields": [
      "first name",
      "last name",
      "birthday",
      "death",
      "gender"
    ],
    "cardDisplay": [
      ["first name", "last name"],
      ["birthday", "death"]
    ]
  },
  "data": [
    {
      "id": "1",
      "data": {"first name": "John", "last name": "Doe", "gender": "M"},
      "rels": {"spouses": ["2"], "children": ["3"]}
    }
  ]
}
```

> Already using a plain array `[]`? Keep it as-is. The viewer and builder load it, and the next save automatically wraps the payload with a `config` block.

See `docs/data-format.md` for the complete schema (parents/spouses/children relations, legacy variations, examples).

## Documentation

- [Installation & Quick Start](docs/installation-and-quickstart.md)
- [Data Format](docs/data-format.md)
- [API Reference (héritée)](https://donatso.github.io/family-chart/) — Chart, EditTree, CardHtml
- [Examples & Builder (hérités)](https://donatso.github.io/family-chart-doc/)

## Support & Feedback

- File a ticket on [GitHub Issues](https://github.com/donatso/family-chart/issues) with steps to reproduce and your browser version (hérité de l’amont).
- General questions or feature requests: [donatso.dev@gmail.com](mailto:donatso.dev@gmail.com).

## License

Distributed under the MIT License. See `LICENSE.txt` for details.

## Contact

- Projet amont : [https://github.com/donatso/family-chart](https://github.com/donatso/family-chart)
