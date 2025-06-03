# Dockerfile multi-stage pour Claude Doc Bot
FROM node:18-alpine AS base

# Installer pnpm
RUN npm install -g pnpm@8.15.0

# Stage 1: Builder
FROM base AS builder
WORKDIR /app

# Copier les fichiers de configuration du workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY worker/package.json ./worker/
COPY api/package.json ./api/
COPY web/package.json ./web/

# Installer toutes les dépendances
RUN pnpm install --frozen-lockfile

# Copier le code source
COPY worker/ ./worker/
COPY api/ ./api/
COPY web/ ./web/

# Build tous les packages
RUN pnpm build

# Stage 2: Production Runtime
FROM node:18-alpine AS runner
WORKDIR /app

# Installer les dépendances système pour Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Installer pnpm
RUN npm install -g pnpm@8.15.0

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers de configuration
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copier les builds
COPY --from=builder /app/worker/dist ./worker/dist/
COPY --from=builder /app/worker/package.json ./worker/
COPY --from=builder /app/api/dist ./api/dist/
COPY --from=builder /app/api/package.json ./api/
COPY --from=builder /app/web/.next ./web/.next/
COPY --from=builder /app/web/package.json ./web/
COPY --from=builder /app/web/public ./web/public/

# Installer seulement les dépendances de production
RUN pnpm install --prod --frozen-lockfile

# Créer les dossiers nécessaires
RUN mkdir -p outputs prompts
RUN chown -R nextjs:nodejs /app

# Configuration Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3001

# Exposer le port
EXPOSE 3001

# Changer vers l'utilisateur non-root
USER nextjs

# Commande par défaut (API + Worker)
CMD ["pnpm", "--filter", "@claude-doc-bot/api", "start"] 