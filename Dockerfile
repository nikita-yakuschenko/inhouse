FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma generate не ходит в БД — URL только для конфига
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/cutting"
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/cutting"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app ./
RUN chmod +x scripts/docker-entrypoint.sh
EXPOSE 3000
# ждём БД → схема → seed → start (seed upsert, данные не затирает)
CMD ["sh", "scripts/docker-entrypoint.sh"]
