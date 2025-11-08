# syntax=docker/dockerfile:1

FROM python:3.13-slim AS base

WORKDIR /app

COPY tools/sqlite/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY tools/sqlite ./tools/sqlite

# Seed data is optional: copy the default JSON snapshot when it exists, but do
# not require it for the image to build (the API can bootstrap an empty DB).
RUN mkdir -p /app/seed-data
COPY data/tree.json /app/seed-data/tree.json
RUN mkdir -p /data && if [ -f /app/seed-data/tree.json ]; then cp /app/seed-data/tree.json /data/tree.json; fi

ENV FAMILY_SQLITE_PATH=/data/family.db
ENV FAMILY_TREE_JSON_PATH=/data/tree.json
ENV FLASK_ENV=production

EXPOSE 5001

CMD ["python", "tools/sqlite/api.py"]
