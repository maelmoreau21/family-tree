# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/static ./static
COPY --from=build /app/examples ./examples
COPY --from=build /app/src/styles ./src/styles
COPY --from=build /app/uploads ./uploads
RUN mkdir -p /data /app/uploads
ENV NODE_ENV=production
ENV TREE_DB_PATH=/data/family.db
ENV TREE_DATA_PATH=/data/family.db
ENV VIEWER_PORT=7920
ENV BUILDER_PORT=7921
EXPOSE 7920 7921
VOLUME ["/data", "/app/uploads"]
CMD ["node", "server/index.js"]
