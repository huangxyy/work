# =============================================================================
# Multi-stage production Dockerfile for Homework AI
# Builds: backend API, worker, and frontend static files in a single image
# Usage:
#   docker build -t homework-ai .
#   docker run -p 3000:3000 --env-file .env homework-ai             # API
#   docker run --env-file .env homework-ai node dist/worker/main.js  # Worker
# =============================================================================

# --- Stage 1: Install all dependencies ---
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --frozen-lockfile || pnpm install

# --- Stage 2: Build backend ---
FROM deps AS backend-build
COPY apps/backend/prisma ./apps/backend/prisma
RUN pnpm --filter backend prisma:generate

COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig.json apps/backend/tsconfig.build.json apps/backend/nest-cli.json ./apps/backend/

RUN pnpm --filter backend build

# --- Stage 3: Build frontend ---
FROM deps AS frontend-build
COPY apps/frontend ./apps/frontend

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter frontend build

# --- Stage 4: Production backend image ---
FROM node:20-slim AS backend
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/apps/backend/dist ./dist
COPY --from=backend-build /app/apps/backend/prisma ./prisma
COPY --from=backend-build /app/apps/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-build /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/@prisma/client

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]

# --- Stage 5: Production frontend image (nginx) ---
FROM nginx:1.27-alpine AS frontend
COPY --from=frontend-build /app/apps/frontend/dist /usr/share/nginx/html
COPY deploy/nginx/nginx.prod.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
