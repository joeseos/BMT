# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci

# copy source
COPY . .

# generate database migrations from schema
RUN npx drizzle-kit generate

# build the app
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# install production dependencies only
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

# copy build output and migrations
COPY --from=builder /app/.output .output
COPY --from=builder /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=builder /app/scripts ./scripts

COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p /app/data

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
