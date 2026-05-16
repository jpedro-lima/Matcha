# syntax=docker/dockerfile:1.7

# ── Stage 1: build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ───────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

RUN mkdir -p /usr/src/app/uploads && \
	addgroup -S app && adduser -S app -G app && \
	chown -R app:app /usr/src/app

USER app

EXPOSE 3000

CMD ["node", "dist/server.js"]
