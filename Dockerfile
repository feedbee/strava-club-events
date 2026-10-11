FROM node:24.21.0-bookworm-slim AS frontend-build
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend ./frontend
COPY public/prototypes/calendar/js/experiment-fixtures.js ./public/prototypes/calendar/js/experiment-fixtures.js
RUN npm run build

FROM node:24.21.0-bookworm-slim
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --from=frontend-build --chown=node:node /usr/src/app/public/next ./public/next
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
