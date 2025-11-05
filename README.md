# Family Tree

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![TypeScript][typescript-shield]][typescript-url]
[![Bundle Size][bundle-shield]][bundle-url]

![Family Tree logo](examples/logo.svg)

Family Tree is a D3.js based visualization library for building rich, interactive family trees. Forked from Family Chart, it ships with a bilingual builder UI, TypeScript typings, and ready-to-use HTML/SVG card renderers so you can focus on your data instead of layout plumbing.

## Features

- 🌳 Interactive tree navigation with zoom, pan, and history controls
- 🧩 HTML & SVG card renderers with configurable layouts and image slots
- 🛠️ Visual builder (FR) with live preview, auto-save, and undo/redo
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
- Snapshots are exposed over `/api/backups` (JSON list) and `/api/backups/<filename>` (raw download) so you can script exports or restore points.

## Docker

```powershell
$dataDir = "C:\path\to\tree-data"
docker build -t family-tree .
docker run `
  --rm `
  -p 7920:7920 `
  -p 7921:7921 `
  -e TREE_DATA_PATH=/data/tree.json `
  -e VIEWER_PORT=7920 `
  -e BUILDER_PORT=7921 `
  -v ${dataDir}:/data `
  family-tree
```

- The container creates `/data/tree.json` if it does not exist (seeded with sample data) and stores rolling backups under `/data/backups` so mount a folder, not a single file.
- Override `VIEWER_PORT` and `BUILDER_PORT` to publish alternate ports.

### Docker Compose (Windows PowerShell)

```powershell
$env:TREE_DATA_DIR = "C:\path\to\tree-data"
docker compose up --build
```

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

- Email: [donatso.dev@gmail.com](mailto:donatso.dev@gmail.com)
- Projet amont : [https://github.com/donatso/family-chart](https://github.com/donatso/family-chart)

<!-- Badge references -->
[contributors-shield]: https://img.shields.io/github/contributors/donatso/family-chart.svg?style=for-the-badge
[contributors-url]: https://github.com/donatso/family-chart/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/donatso/family-chart.svg?style=for-the-badge
[forks-url]: https://github.com/donatso/family-chart/network/members
[stars-shield]: https://img.shields.io/github/stars/donatso/family-chart.svg?style=for-the-badge
[stars-url]: https://github.com/donatso/family-chart/stargazers
[issues-shield]: https://img.shields.io/github/issues/donatso/family-chart.svg?style=for-the-badge
[issues-url]: https://github.com/donatso/family-chart/issues
[license-shield]: https://img.shields.io/github/license/donatso/family-chart.svg?style=for-the-badge
[license-url]: https://github.com/donatso/family-chart/blob/master/LICENSE.txt
[typescript-shield]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[bundle-shield]: https://img.shields.io/bundlephobia/minzip/family-chart?style=for-the-badge
[bundle-url]: https://bundlephobia.com/package/family-chart

