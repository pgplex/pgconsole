# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10

# Dependencies (cached unless package.json/lockfile change)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Source code (invalidated on every code change, but deps above are cached)
COPY . .
ARG GIT_COMMIT=unknown
RUN GIT_COMMIT=${GIT_COMMIT} pnpm build

# Runtime dependencies
# Generated from esbuild externals + package.json versions (single source of truth).
# Only rebuilds when package.json or build-server.mjs externals change.
FROM node:22-alpine AS runtime-deps

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json ./
COPY scripts/build-server.mjs scripts/gen-runtime-package.mjs ./scripts/
RUN node scripts/gen-runtime-package.mjs > runtime-package.json \
  && mv runtime-package.json package.json \
  && pnpm install --prod --no-lockfile \
  && find node_modules -type f \( \
       -name "*.md" -o -name "*.markdown" -o \
       -name "*.ts" -o -name "*.d.ts" -o -name "*.d.ts.map" -o \
       -name "*.map" -o \
       -name "LICENSE*" -o -name "CHANGELOG*" -o \
       -name ".npmignore" -o -name ".eslintrc*" -o \
       -name "tsconfig*.json" \
     \) -delete 2>/dev/null; \
     find node_modules -type d -name "@types" -exec rm -rf {} + 2>/dev/null; \
     true

# Final runtime image — plain alpine + node binary (no npm/yarn/corepack)
# Layers ordered least → most frequently changing for cache efficiency
FROM alpine:3.21

RUN apk add --no-cache libstdc++

COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

# 1. Entrypoint — rarely changes
COPY docker-entrypoint.sh /app/

# 2. Runtime node_modules — changes only when externals or dep versions change
COPY --from=runtime-deps /app/node_modules ./node_modules

# 3. package.json — changes on version bumps
COPY --from=builder /app/package.json ./

# 4. Frontend assets — changes with frontend code
COPY --from=builder /app/dist/client ./dist/client

# 5. Server bundle — changes most often
COPY --from=builder /app/dist/server.mjs ./dist/server.mjs

# ARGs/LABELs last — GIT_COMMIT changes every build, would bust cache above
ARG GIT_COMMIT=unknown
ARG VERSION=unknown
LABEL org.opencontainers.image.version=${VERSION}
LABEL org.opencontainers.image.revision=${GIT_COMMIT}

ENV NODE_ENV=production
ENV PORT=9876
EXPOSE 9876

ENTRYPOINT ["/app/docker-entrypoint.sh"]
