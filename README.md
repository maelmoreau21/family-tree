# Family Tree (FR)

Family Tree est une fourche de **family-chart**. Cette version inclut une API serveur (Express), un visualiseur (viewer) et un éditeur visuel (builder).

Résumé rapide

- Viewer : http://localhost:7920
- Builder : http://localhost:7921
- Base de données : data/family.db (modifiable via TREE_DB_PATH)

Démarrage

```powershell
npm install
npm run build
npm start
```

Administration & maintenance

- Import massif : POST /api/admin/import (options : dropIndexes, fastImport)
- Rebuild FTS : POST /api/admin/rebuild-fts
- Maintenance rapide : scripts/db-maintenance.mjs (ANALYZE, REINDEX, checkpoint, backup)

Notes

- `fastImport` accélère l'import mais réduit la durabilité (PRAGMA synchronous=OFF). Toujours sauvegarder avant et exécuter le script de maintenance après.
- Protégez les endpoints admin (auth / réseau) en production.

Licence : MIT (voir LICENSE.txt)
