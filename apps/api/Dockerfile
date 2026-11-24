# syntax=docker/dockerfile:1.7
# API (NestJS + Prisma). Build konteksti: repo ildizi.
#   docker build -f apps/api/Dockerfile -t taklifnoma-api .

ARG NODE_VERSION=24.22.3

# glibc (bookworm): sharp, argon2 va Prisma engine'lari uchun tayyor binarlar bor.
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Faqat package.json'lar: kod o'zgarganda npm ci keshdan olinadi.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma

# --- Build: barcha bog'liqliklar bilan ---
FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
  npm ci -w @taklifnoma/shared -w @taklifnoma/api
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @taklifnoma/shared \
  && npm run build -w @taklifnoma/api

# --- Faqat production bog'liqliklari ---
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev -w @taklifnoma/shared -w @taklifnoma/api
# Prisma client va engine'larni aniq generatsiya qilamiz (konteynerda internet/yozish kerak bo'lmasin).
RUN cd apps/api && node /app/node_modules/prisma/build/index.js generate \
  && node /app/node_modules/prisma/build/index.js --version

# --- Runtime ---
FROM base AS runtime
ENV NODE_ENV=production \
  PORT=3000
COPY --from=prod-deps /app ./
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/dist-seed apps/api/dist-seed
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
