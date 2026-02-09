FROM node:20-bookworm-slim
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

# Copy workspace manifests (include lockfile if present)
COPY pnpm-workspace.yaml package.json ./
# If pnpm-lock.yaml exists in repo, copy it too
# (use a separate COPY so build does not fail if file missing)
COPY pnpm-lock.yaml* ./

# Copy only the frontend manifest for dependency install
COPY apps/frontend/package.json apps/frontend/package.json

# Install frontend deps including devDeps (vite is devDep)
# Use path filter to avoid any mismatch
RUN pnpm install --filter ./apps/frontend... --prod=false

# Now copy frontend source
COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend
EXPOSE 5173
CMD ["pnpm","dev","--host","0.0.0.0","--port","5173"]
