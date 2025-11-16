# Family Tree — Démarrage (Docker)

Un guide rapide pour démarrer l'application localement via Docker.

## Lancer via Docker (run)

Remplacez les valeurs d'environnement par vos valeurs de connexion PostgreSQL.

```bash
docker run --rm -p 7920:7920 -p 7921:7921 \
  -e DATABASE_URL="postgresql://user:password@dbhost:5432/family_tree" \
  -v "$(pwd)/uploads:/app/uploads" \
  ghcr.io/<votre-registre>/family-tree:latest
```

## Lancer via Docker Compose

Remplacez les valeurs d'environnement par vos valeurs

```bash
services:
  postgres:
    image: postgres:16-alpine
    container_name: family-tree-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: family
      POSTGRES_PASSWORD: family
      POSTGRES_DB: family_tree
    ports:
      - "5433:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  family-tree:
    build: .
    image: family-tree:latest
    container_name: family-tree
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: "postgresql://family:family@postgres:5432/family_tree"
      TREE_DATA_DIR: "/app/data"
      TREE_BACKUP_DIR: "/app/data/backups"
      TREE_BACKUP_LIMIT: "50"
      TREE_PAYLOAD_LIMIT: "100mb"
      VIEWER_PORT: "7920"
      BUILDER_PORT: "7921"
    ports:
      - "7920:7920"
      - "7921:7921"
    volumes:
      - ./data/backups:/app/data/backups
      - ./uploads:/app/uploads
```

Le fichier `docker-compose.yml` démarre l'application et PostgreSQL pour le développement local.

```bash
docker compose up -d --build
```

---

## Ports

- Viewer: 7920
- Builder: 7921

## Licence

MIT — voir `LICENSE.txt`.
