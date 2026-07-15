FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config читает URL при generate
ENV DATABASE_URL="postgresql://cutting:cutting@postgres:5432/cutting"
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://cutting:cutting@postgres:5432/cutting"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Prisma CLI нужен для migrate deploy (пакет в devDependencies)
COPY --from=builder /app ./
EXPOSE 3000
# миграций в репо нет — схема накатывается через db push
CMD ["sh", "-c", "npx prisma db push && npm start"]
