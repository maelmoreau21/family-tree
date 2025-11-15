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
