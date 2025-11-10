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
- Imports massifs : pour ajuster la taille des batchs SQL, utilisez `TREE_IMPORT_PERSON_CHUNK`, `TREE_IMPORT_RELATIONSHIP_CHUNK` et `TREE_IMPORT_FTS_CHUNK` (valeurs par défaut respectives : 500, 1000 et 500).

Pattern d'import massif recommandé :

1. Sauvegarder la base actuelle.
2. Appeler `/api/admin/import` avec `dropIndexes=true` et (optionnel) `fastImport=true`.
3. Exécuter `scripts/db-maintenance.mjs` pour `ANALYZE`/`VACUUM` et vérifier le backup JSON.

## Sécurité

- Protégez les endpoints d'administration (authentification, réseau privé, reverse-proxy) avant exposition.
- `fastImport` améliore les performances mais accroît le risque de perte en cas de crash : documentez-le clairement et n'autorisez son usage qu'à des administrateurs.
- Définissez `TREE_ADMIN_TOKEN` pour exiger un jeton (en-tête `X-Admin-Token` ou `Authorization: Bearer`) sur toutes les opérations d'écriture (`PUT /api/tree`, `/api/admin/*`, uploads).
- Optionnel : `TREE_ALLOWED_ORIGINS` accepte une liste d'origines séparées par des virgules pour restreindre le CORS (`https://app.exemple.com,https://admin.exemple.com`). Laisser vide autorise toutes les origines.

## Développement & build

- `npm run dev` — démarre Vite pour le développement (HMR pour l'UI statique)
- `npm run build` — génère la librairie et les bundles viewer/builder

## Licence

Distribué sous licence MIT — voir `LICENSE.txt`.

## API rapide et exemples

Voici un petit exemple d'utilisation côté application pour créer un chart et le peupler depuis un tableau de personnes :

```javascript
import * as f3 from 'family-tree';
import 'family-tree/dist/styles/family-tree.css';

const data = [
  { id: '1', data: { 'first name': 'John', 'last name': 'Doe', birthday: '1980', gender: 'M' }, rels: { spouses: ['2'], children: ['3'] } },
  { id: '2', data: { 'first name': 'Jane', 'last name': 'Doe', birthday: '1982', gender: 'F' }, rels: { spouses: ['1'], children: ['3'] } },
  { id: '3', data: { 'first name': 'Bob', 'last name': 'Doe', birthday: '2005', gender: 'M' }, rels: { parents: ['1','2'] } }
];

const f3Chart = f3.createChart('#FamilyChart', data);
f3Chart.setCardHtml().setCardDisplay([['first name','last name'],['birthday']]);
f3Chart.updateTree({ initial: true });
```

Composants principaux :

- `f3Chart` — classe principale pour créer et configurer l'arbre
- `f3Card` — rendu HTML des cartes
- `f3EditTree` — outils d'édition, formulaires et historique

Ressources utiles :

- Exemples live : [https://donatso.github.io/family-chart-doc/examples/](https://donatso.github.io/family-chart-doc/examples/)
- Référentiel source (amont) : [https://github.com/donatso/family-chart](https://github.com/donatso/family-chart)

## Format des données

Chaque personne est un objet avec `id`, `data` et `rels`.

Structure de base :

- `id` (string) — identifiant unique de la personne
- `data` (object) — attributs descriptifs (prénom, nom, date de naissance, etc.)
- `rels` (object) — relations (`parents`, `spouses`, `children`)

Exemple minimal :

```json
{
  "id": "1",
  "data": { "first name": "John", "last name": "Doe", "gender": "M", "birthday": "1980" },
  "rels": { "spouses": ["2"], "children": ["3"] }
}
```

Propriétés recommandées :

- `first name`, `last name`, `birthday`, `death`, `gender` sont courantes et utilisées par le rendu.
- Tout champ personnalisé peut être ajouté dans `data` (ex. `occupation`, `notes`, `location`).

Relations :

- `parents`: tableau d'IDs (0, 1 ou 2 éléments)
- `spouses`: tableau d'IDs (permet plusieurs unions)
- `children`: tableau d'IDs

Le loader convertit automatiquement certains formats hérités (par ex. `father`/`mother`) en `rels.parents` pour conserver la rétrocompatibilité.
