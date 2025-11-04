# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/static ./static
COPY --from=build /app/examples ./examples
COPY --from=build /app/src/styles ./src/styles
ENV NODE_ENV=production
ENV TREE_DATA_PATH=/data/tree.json
ENV VIEWER_PORT=7920
ENV BUILDER_PORT=7921
EXPOSE 7920 7921
CMD ["node", "server/index.js"]
