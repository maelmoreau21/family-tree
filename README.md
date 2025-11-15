Family Tree — Démarrage (Docker)

Ce dépôt contient l'application Family Tree (viewer + builder + API).

Méthode 1 — Lancer avec docker run

Remplacez les valeurs d'environnement par vos valeurs de connexion PostgreSQL.

```bash
docker run --rm -p 7920:7920 -p 7921:7921 \
  -e DATABASE_URL="postgresql://user:password@dbhost:5432/family_tree" \
  -v "$(pwd)/uploads:/app/uploads" \
  ghcr.io/<votre-registre>/family-tree:latest
```

Méthode 2 — Lancer avec Docker Compose

Le fichier `docker-compose.yml` inclus démarre l'application et une base Postgres pour le développement local.

```bash
docker compose up -d --build
```

---

Licence: MIT — voir `LICENSE.txt`.

