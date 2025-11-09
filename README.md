# Family Tree (FR)

Family Tree est une fourche de **family-chart**. Cette version inclut une API serveur (Express), un visualiseur (viewer) et un éditeur visuel (builder).

# Family Tree

Family Tree est un fork maintenu de **family-chart** fournissant une bibliothèque de rendu (ESM + typages) ainsi que deux applications web : un visualiseur (viewer) et un éditeur (builder). Le backend est un serveur Express qui utilise SQLite pour stocker le dataset.

Cette documentation rapide couvre le démarrage local, l'utilisation recommandée via Docker, les endpoints d'administration et les opérations de maintenance pour des jeux de données volumineux.

## Démarrage rapide (local)

Prérequis : Node.js 20+ et npm 10+ (développement). Pour la production nous recommandons Docker (voir plus bas).

```powershell
# installer les dépendances
npm install

# générer les bundles (production)
npm run build

# lancer le serveur (production)
npm start

# tests
npm test
```

Accès locaux :

- Viewer : http://localhost:7920
- Builder : http://localhost:7921

La base SQLite par défaut est `data/family.db`. Vous pouvez la remplacer via la variable d'environnement `TREE_DB_PATH`.

## Utilisation recommandée : Docker (recommandé pour production)

Exécuter l'application dans un conteneur Docker est recommandé pour la cohérence d'environnement, la persistance et la gestion des volumes (backups, uploads). Exemple PowerShell :

```powershell
$dataDir    = "C:\path\to\tree-data"
$uploadsDir = "C:\path\to\tree-uploads"

docker build -t family-tree .
docker run --rm -p 7920:7920 -p 7921:7921 -e TREE_DB_PATH=/data/family.db -v ${dataDir}:/data -v ${uploadsDir}:/app/uploads family-tree
```

Le conteneur initialise `/data/family.db` si absent et conserve des sauvegardes rolling dans `/data/backups`. Monter le dossier des uploads permet de persister les avatars.

## Endpoints d'administration importants

Ces endpoints sont destinés à un usage admin (protégez-les en production) :

- `POST /api/admin/import` — importe un snapshot JSON (même format que le builder). Paramètres utiles :
	- `dropIndexes=true|false` : supprimer les indexes avant import et les recréer après (accélère les imports massifs)
	- `fastImport=true|false` : activer un mode d'import rapide qui assouplit les PRAGMA SQLite (synchronous=OFF). Accélère beaucoup mais réduit la durabilité — prenez une sauvegarde avant et exécutez la maintenance après.

- `POST /api/admin/rebuild-fts` — reconstruit l'index FTS5 à partir de la table `persons`.

- `POST /api/admin/reset-to-seed?confirm=yes` — réinitialise la base au seed configuré (nécessite `confirm=yes`).

Exemple d'appel PowerShell pour un import rapide :

```powershell
# $json = Get-Content .\import.json -Raw
# Invoke-RestMethod -Method Post -Uri 'http://localhost:7921/api/admin/import?dropIndexes=true&fastImport=true' -Body $json -ContentType 'application/json'
```

## Maintenance & sauvegardes

- Script utile : `scripts/db-maintenance.mjs` — exécute `ANALYZE`, `REINDEX`, checkpoint WAL et crée un backup horodaté dans le dossier de backup (`data/backups` par défaut). Activez `FORCE_VACUUM=1` pour lancer `VACUUM` si vous avez besoin de compaction (opération lente).
- Backups rolling : contrôlés par `TREE_BACKUP_DIR` et `TREE_BACKUP_LIMIT`.

Pattern d'import massif recommandé :
1. Sauvegarder la base actuelle.
2. Appeler `/api/admin/import` avec `dropIndexes=true` et (optionnel) `fastImport=true`.
3. Exécuter `scripts/db-maintenance.mjs` pour checkpoint/ANALYZE/REINDEX et vérifier le backup.

## Sécurité

- Protégez les endpoints d'administration (authentification, réseau privé, reverse-proxy) avant exposition.
- `fastImport` améliore les performances mais accroît le risque de perte en cas de crash : documentez-le clairement et n'autorisez son usage qu'à des administrateurs.

## Développement & build

- `npm run dev` — démarre Vite pour le développement (HMR pour l'UI statique)
- `npm run build` — génère la librairie et les bundles viewer/builder

## Licence

Distribué sous licence MIT — voir `LICENSE.txt`.
