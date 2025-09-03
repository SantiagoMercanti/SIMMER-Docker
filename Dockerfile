# ---- Build stage ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Instalar deps (usa lockfile si lo tenés)
COPY package*.json ./
RUN npm ci

# Prisma: generar cliente con schema disponible
COPY prisma ./prisma
RUN npx prisma generate

# Copiar el resto del código y compilar Next
COPY . .
# Importante: en next.config.ts tenés basePath="/a03" y output="standalone"
RUN npm run build

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiamos lo mínimo para correr en modo "standalone"
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Aplicar migraciones y arrancar
CMD ["bash", "-lc", "npx prisma migrate deploy && node server.js"]
