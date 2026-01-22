FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --filter backend --prod=false

COPY apps/backend ./apps/backend
COPY apps/backend/prisma ./apps/backend/prisma

RUN pnpm --filter backend prisma generate
RUN pnpm --filter backend build

CMD ["node", "apps/backend/dist/main.js"]