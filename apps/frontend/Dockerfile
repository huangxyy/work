FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json

# Install only frontend deps
RUN pnpm install --filter frontend... --frozen-lockfile=false

# Copy frontend source
COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend
EXPOSE 5173

# Vite dev server must listen on all interfaces inside container
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
