# syntax=docker/dockerfile:1

FROM python:3.13-slim AS base

WORKDIR /app

COPY tools/sqlite/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY tools/sqlite ./tools/sqlite
COPY data ./data
RUN mkdir -p /data

ENV FAMILY_SQLITE_PATH=/data/family.db
ENV FAMILY_TREE_JSON_PATH=/data/tree.json
ENV FLASK_ENV=production

EXPOSE 5001

CMD ["python", "tools/sqlite/api.py"]
