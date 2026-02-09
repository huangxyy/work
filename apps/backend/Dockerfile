FROM node:20-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

COPY apps/backend/prisma ./apps/backend/prisma

RUN pnpm install --filter backend --prod=false

COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig.json apps/backend/tsconfig.build.json apps/backend/nest-cli.json ./apps/backend/

RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

CMD ["node", "apps/backend/dist/main.js"]
