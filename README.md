# Family Tree

> Priorité : GitHub — instructions pour cloner/télécharger, construire une image Docker et lancer l'application (PowerShell inclus).

Family Tree est un fork maintenu de **family-chart**. Il fournit :

- une bibliothèque TypeScript/ESM avec typages (`dist/`),
- deux applications web statiques (viewer & builder),
- un serveur Express pour l'API et la persistance (PostgreSQL).

Ce document explique comment récupérer le dépôt depuis GitHub, construire une image Docker et démarrer l'application (méthode manuelle et via Docker Compose).

---

## 1) Récupérer le code (GitHub)

Option A — cloner (recommandé si vous comptez modifier le code) :

```powershell
# Cloner le dépôt
git clone https://github.com/maelmoreau21/family-tree.git
cd family-tree

# (Option SSH)
# git clone git@github.com:maelmoreau21/family-tree.git
```

Option B — télécharger un ZIP via l'interface GitHub

- Rendez-vous sur [maelmoreau21/family-tree](https://github.com/maelmoreau21/family-tree)
- Cliquez sur « Code » → « Download ZIP » → décompressez.

---

## 2) Préparer l'environnement (rapide)

Prérequis : Node.js (pour développement). Pour la production, Docker est recommandé.

```powershell
# installer les dépendances (dev)
npm.cmd install

# lancer les tests
npm.cmd test

# compiler (génère dist/)
npm.cmd run build
```

> Remarque : sur PowerShell utilisez `npm.cmd` pour éviter les problèmes liés aux shims `.ps1`.

---

## 3) Construire une image Docker (manuellement)

1. Construire l'image :

```powershell
# depuis la racine du projet
docker build -t family-tree:latest .
```

1. Lancer le conteneur (exemple simple) :

```powershell
# Exemple : expose viewer (7920) et builder (7921)
docker run -d `
  -p 7920:7920 -p 7921:7921 `
  -e "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/family_tree" `
  --name family-tree `
  family-tree:latest
```

1. Vérifier :

- Viewer : <http://localhost:7920>
- Builder : <http://localhost:7921>

Notes :

- En production, fournissez une base PostgreSQL séparée et montez des volumes pour `./uploads` et `./data/backups`.

---

## 4) Lancer avec Docker Compose (recommandé)

Le dépôt contient `docker-compose.yml` qui démarre PostgreSQL + l'application.

```powershell
# build & start en arrière-plan
docker compose up --build -d

# suivre les logs
docker compose logs -f

# arrêter et supprimer
docker compose down
```

Par défaut :

- PostgreSQL peut écouter sur `localhost:5433` selon la configuration du compose.
- Viewer → <http://localhost:7920>
- Builder → <http://localhost:7921>

Consultez `docker-compose.yml` pour adapter ports, volumes et variables d'environnement.

---

## 5) Variables d'environnement importantes

- `DATABASE_URL` (ou `TREE_DATABASE_URL`) — URL de connexion PostgreSQL.
- `TREE_ADMIN_TOKEN` — jeton admin pour protéger les endpoints d'admin (header `X-Admin-Token` ou `Authorization: Bearer`).
- `TREE_MAX_UPLOAD_MB` — taille max upload images (par défaut 5).

Exemple `docker run` avec variables :

```powershell
docker run -d -p 7920:7920 -p 7921:7921 `
  -e DATABASE_URL="postgresql://user:pass@db:5432/family_tree" `
  -e TREE_ADMIN_TOKEN="votre-token" `
  --name family-tree family-tree:latest
```

---

## 6) CI / Docs / Déploiement GitHub

- La CI (GitHub Actions) est configurée dans `.github/workflows/` pour lancer lint/tests/build sur push/PR.
- Générer la doc API : `npm run docs`.
- Déployer docs (gh-pages) : `npm run docs:deploy` (configuration `gh-pages` requise).

---

## 7) Import massif & maintenance

- Endpoint utile : `POST /api/admin/import` (paramètres `dropIndexes`, `fastImport` — voir `docs/`).
- Script de maintenance : `scripts/db-maintenance.mjs` (ANALYZE / VACUUM / snapshot JSON).

Exemple PowerShell pour importer :

```powershell
$json = Get-Content .\import.json -Raw
Invoke-RestMethod -Method Post -Uri 'http://localhost:7921/api/admin/import?dropIndexes=true&fastImport=true' -Body $json -ContentType 'application/json'
```

---

Licence : MIT — voir `LICENSE.txt`

## Nouveautés (Éditeur / Builder)

Cette branche a introduit plusieurs améliorations UX pour l'éditeur (builder) :

- Indicateur de chargement progressif lors de la construction/rafraîchissement du graphe.
- Fil d’Ariane (breadcrumb) affichant l’arborescence jusqu’à la personne active.
- Mise au point visuelle temporaire des cartes lorsque l’on cible une personne (highlight + pulse).
- Meilleure mise au point du champ de recherche (focus + sélection du texte) pour l’édition rapide.
- Transitions de recentrage légèrement adoucies (transition par défaut augmentée pour des panoramiques plus fluides).

Ces changements concernent principalement les fichiers :

- `static/builder/builder.js`
- `static/builder/index.html`
- `static/builder/builder.css`

Si vous remarquez un comportement inattendu dans l’éditeur, ouvrez une issue en indiquant :

- la version du navigateur
- la page testée (Builder / Viewer)
- les étapes pour reproduire

## Notes développeur — tests & vérifications rapides

Pour exécuter les tests unitaires et la vérification TypeScript localement :

- Sur Windows PowerShell (si vous rencontrez des erreurs liées à la politique d’exécution) : utilisez `cmd` ou `npm.cmd` depuis PowerShell.

Exemples de commandes :

```powershell
# via cmd.exe (évite la politique d'exécution PowerShell)
cmd /c "npm test"

# ou depuis PowerShell en appelant explicitement npm.cmd
npm.cmd install
npm.cmd test

# Vérification TypeScript (sans générer de fichiers)
cmd /c "npx tsc --noEmit"
```

Remarque : si PowerShell bloque l’exécution des scripts (`.ps1`), vous pouvez temporairement lancer :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Mais la manière la plus sûre est d'exécuter `npm` via `cmd` ou `npm.cmd` depuis PowerShell.

---
