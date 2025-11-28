# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
# Install dependencies for building sharp from source if needed
RUN apk add --no-cache libc6-compat vips-dev build-base python3
WORKDIR /app
COPY package.json package-lock.json ./
# Tell sharp to use the system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
# Install runtime dependencies for sharp
RUN apk add --no-cache vips
WORKDIR /app
COPY package.json package-lock.json ./
# Tell sharp to use the system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/static ./static
COPY --from=build /app/src/styles ./src/styles
RUN mkdir -p /app/data/backups /app/document
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://family:family@postgres:5432/family_tree
ENV TREE_DATA_DIR=/app/data
ENV TREE_BACKUP_DIR=/app/data/backups
ENV VIEWER_PORT=7920
ENV BUILDER_PORT=7921
EXPOSE 7920 7921
VOLUME ["/app/data/backups", "/app/document"]
CMD ["node", "server/index.js"]
