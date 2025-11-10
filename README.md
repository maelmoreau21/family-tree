# Family Tree

Family Tree est un fork maintenu de **family-chart** fournissant une bibliothèque de rendu (ESM + typages) ainsi que deux applications web : un visualiseur (viewer) et un éditeur (builder). Le backend est un serveur Express qui persiste le dataset dans PostgreSQL.

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

- Viewer : [http://localhost:7920](http://localhost:7920)
- Builder : [http://localhost:7921](http://localhost:7921)

Configurez `DATABASE_URL` (ou `TREE_DATABASE_URL`) vers votre instance PostgreSQL. À défaut, l'application tente `postgresql://postgres:postgres@localhost:5432/family_tree`.

## Utilisation recommandée : Docker (recommandé pour production)

Exécuter l'application dans un conteneur Docker est recommandé pour la cohérence d'environnement, la persistance et la gestion des volumes (backups, uploads). Le fichier `docker-compose.yml` démarre une base PostgreSQL et l'application avec les bons volumes :

```powershell
docker compose up --build
```

Par défaut :

- PostgreSQL écoute sur `localhost:5433` (modifiable dans `docker-compose.yml`).
- L'application expose le viewer sur [http://localhost:7920](http://localhost:7920) et le builder sur [http://localhost:7921](http://localhost:7921).
- Les sauvegardes JSON sont stockées dans `./data/backups` et les uploads dans `./uploads`.

## Endpoints d'administration importants

Ces endpoints sont destinés à un usage admin (protégez-les en production) :

- `POST /api/admin/import` — importe un snapshot JSON (même format que le builder). Paramètres utiles :
  - `dropIndexes=true|false` : supprimer les indexes avant import et les recréer après (accélère les imports massifs).
  - `fastImport=true|false` : désactive temporairement `synchronous_commit` pendant l'import, ce qui accélère considérablement l'écriture au prix d'une durabilité réduite (prenez une sauvegarde avant).

- `POST /api/admin/rebuild-fts` — reconstruit le tsvector de recherche à partir de la table `persons`.

- `POST /api/admin/reset-to-seed?confirm=yes` — réinitialise la base au seed configuré (nécessite `confirm=yes`).

Exemple d'appel PowerShell pour un import rapide :

```powershell
# $json = Get-Content .\import.json -Raw
# Invoke-RestMethod -Method Post -Uri 'http://localhost:7921/api/admin/import?dropIndexes=true&fastImport=true' -Body $json -ContentType 'application/json'
```

## Maintenance & sauvegardes

- Script utile : `scripts/db-maintenance.mjs` — exécute `ANALYZE`, `VACUUM` et écrit un snapshot JSON horodaté dans le dossier de backup (`data/backups` par défaut). Activez `FORCE_VACUUM=1` pour lancer `VACUUM (FULL, ANALYZE)` si une compaction complète est nécessaire.
- Backups rolling : contrôlés par `TREE_BACKUP_DIR` et `TREE_BACKUP_LIMIT`.

Pattern d'import massif recommandé :

1. Sauvegarder la base actuelle.
2. Appeler `/api/admin/import` avec `dropIndexes=true` et (optionnel) `fastImport=true`.
3. Exécuter `scripts/db-maintenance.mjs` pour `ANALYZE`/`VACUUM` et vérifier le backup JSON.

## Sécurité

- Protégez les endpoints d'administration (authentification, réseau privé, reverse-proxy) avant exposition.
- `fastImport` améliore les performances mais accroît le risque de perte en cas de crash : documentez-le clairement et n'autorisez son usage qu'à des administrateurs.

## Développement & build

- `npm run dev` — démarre Vite pour le développement (HMR pour l'UI statique)
- `npm run build` — génère la librairie et les bundles viewer/builder

## Licence

Distribué sous licence MIT — voir `LICENSE.txt`.
