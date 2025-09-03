# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---------- dev ----------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules /app/node_modules
COPY prisma ./prisma
COPY . .
RUN npx prisma generate
EXPOSE 3000
# El comando real lo define docker-compose.dev.yml

# ---------- prod ----------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY prisma ./prisma
COPY . .
RUN npx prisma generate
# RUN npm run build     # si usás build de Next para prod
EXPOSE 3000
CMD sh -c "npx prisma migrate deploy && npm run start"
