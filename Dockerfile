# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true
# Recomendado para Next/sharp en Alpine
RUN apk add --no-cache libc6-compat

# ---------- deps ----------
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---------- dev (igual que antes) ----------
FROM base AS dev
ENV NODE_ENV=development

# Reutiliza deps cacheadas
COPY --from=deps /app/node_modules /app/node_modules

# Copia prisma y el resto del código
COPY prisma ./prisma
COPY . .

# Genera Prisma Client para dev
RUN npx prisma generate

EXPOSE 3000
# El comando real lo define docker-compose.dev.yml (ej: "npx prisma migrate dev && npm run dev")

# ---------- builder (compila Next en modo standalone) ----------
FROM base AS builder
# Fija basePath en build-time (importante para /a03)
ARG BASE_PATH=""
ARG NEXT_PUBLIC_BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# Instala TODAS las deps para poder buildear (incluye devDeps)
COPY package*.json ./
RUN npm ci

# Código y Prisma
COPY prisma ./prisma
COPY . .

# Build + Prisma client
RUN npx prisma generate
RUN npm run build

# Podá devDeps antes de pasar al runner
RUN npm prune --omit=dev

# ---------- runner (mínimo para ejecutar standalone) ----------
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
# Copia el runtime standalone y los estáticos
# - server.js y node_modules "slim" quedan en /.next/standalone
COPY --from=builder /app/.next/standalone ./
# - estáticos que el server servirá desde .next/static
COPY --from=builder /app/.next/static ./.next/static
# - archivos públicos
COPY --from=builder /app/public ./public
# - schema de Prisma (para migrate deploy en runtime)
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
# Importante: aplicamos migrations pendientes y luego arrancamos el server de Next standalone

# Esto es para iniciar sin seed en producción
#CMD sh -lc "npx prisma migrate deploy && node server.js" 
# Esto es para iniciar con seed en producción (ej: admin user)
CMD sh -lc "npx prisma migrate deploy && npx prisma db seed && node server.js"

