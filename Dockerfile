# Production-compatible image for Coolify and isolated staging.
FROM node:24-bookworm AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable \
  && corepack prepare pnpm@12.18.0 --activate \
  && pnpm install --frozen-lockfile

COPY . .

# Prisma 7 reads prisma7.config.ts during generation. A synthetic build-only
# URL avoids connecting to any database during the image build; runtime
# DATABASE_URL is injected by Coolify.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
  pnpm db:generate \
  && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src/generated ./src/generated

USER node

EXPOSE 3000

# Equivalent to `pnpm start`, without a package-manager download or lockfile
# write in the non-root runtime container.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
