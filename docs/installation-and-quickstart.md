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

- Viewer : [http://localhost:7920](http://localhost:7920)
- Builder : [http://localhost:7921](http://localhost:7921)

Configurez `DATABASE_URL` (ou `TREE_DATABASE_URL`) vers votre instance PostgreSQL. À défaut, l'application tente `postgresql://postgres:postgres@localhost:5432/family_tree`.

## Test rapide (CDN)

Pour un aperçu sans build, chargez la librairie depuis un CDN :

```html
<script src="https://unpkg.com/d3@7"></script>
<link rel="stylesheet" href="https://unpkg.com/family-tree@latest/dist/styles/family-tree.css">
<script type="module" src="https://unpkg.com/family-tree@latest"></script>
```

## Docker (recommandé pour production)

Docker est recommandé pour la stabilité et la gestion des volumes (données + uploads). Utilisez simplement :

```powershell
docker compose up --build
```

La stack démarre PostgreSQL (port hôte 5433 par défaut) et l'application (ports 7920/7921) avec des volumes persistants (`./data/backups`, `./uploads`).

## Intégration aux frameworks

Utilisez les snippets d'exemples pour Vue/React/Angular/Svelte : importez `family-tree`, appliquez le CSS et appelez `createChart()` puis `updateTree()`.

## Ressources

- Exemples : [https://donatso.github.io/family-chart-doc/examples/](https://donatso.github.io/family-chart-doc/examples/)
- Projet amont : [https://github.com/donatso/family-chart](https://github.com/donatso/family-chart)
