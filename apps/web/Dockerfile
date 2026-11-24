# syntax=docker/dockerfile:1.7
# Web (Angular SSR). Build konteksti: repo ildizi.
#   docker build -f apps/web/Dockerfile -t taklifnoma-web .

ARG NODE_VERSION=24.22.3

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.npm \
  npm ci --ignore-scripts -w @taklifnoma/shared -w @taklifnoma/web
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @taklifnoma/shared \
  && npm run build -w @taklifnoma/web

# SSR server bundle o'zi yetarli (express va Angular ichida): node_modules kerak emas.
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
  PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/dist/web ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/server.mjs"]
