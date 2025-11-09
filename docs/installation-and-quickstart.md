# Installation & Démarrage rapide (FR)

Ce guide explique comment installer et lancer Family Tree localement, et montre la manière recommandée d'exécuter en production (Docker).

## Installation locale (NPM)

Pré-requis : Node.js 20+ et npm 10+.

```bash
npm install
npm run build    # génère les bundles
npm start        # démarre le serveur Express
```

Par défaut :
- Viewer : http://localhost:7920
- Builder : http://localhost:7921

La base SQLite par défaut est `data/family.db`. Pour changer : exportez `TREE_DB_PATH`.

## Test rapide (CDN)

Pour un aperçu sans build, chargez la librairie depuis un CDN :

```html
<script src="https://unpkg.com/d3@7"></script>
<link rel="stylesheet" href="https://unpkg.com/family-tree@latest/dist/styles/family-tree.css">
<script type="module" src="https://unpkg.com/family-tree@latest"></script>
```

## Docker (recommandé pour production)

Docker est recommandé pour la stabilité et la gestion des volumes (données + uploads). Exemple PowerShell :

```powershell
$dataDir    = "C:\path\to\tree-data"
$uploadsDir = "C:\path\to\tree-uploads"

docker build -t family-tree .
docker run --rm -p 7920:7920 -p 7921:7921 \
	-e TREE_DB_PATH=/data/family.db \
	-v ${dataDir}:/data \
	-v ${uploadsDir}:/app/uploads \
	family-tree
```

Le conteneur initialise `/data/family.db` si absent et écrit des backups dans `/data/backups`.

## Intégration aux frameworks

Utilisez les snippets d'exemples pour Vue/React/Angular/Svelte : importez `family-tree`, appliquez le CSS et appelez `createChart()` puis `updateTree()`.

## Ressources

- Exemples : https://donatso.github.io/family-chart-doc/examples/
- Projet amont : https://github.com/donatso/family-chart
