FROM node:20-alpine AS base

# Alpine não vem com tzdata; sem isso, TZ vira no-op e o processo roda em UTC.
# Fixa o relógio do processo em horário de Brasília para qualquer código (inclusive
# de terceiros) que use Date/date-fns sem passar por timeZone explícito.
RUN apk add --no-cache tzdata
ENV TZ=America/Fortaleza

# Dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG BUILD_ID
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_BUILD_ID=$BUILD_ID
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ARG BUILD_ID
ENV NODE_ENV production
ENV NEXT_PUBLIC_BUILD_ID=$BUILD_ID
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]