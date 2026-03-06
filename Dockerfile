# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm install

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

# copy build output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/drizzle.config.ts drizzle.config.ts
COPY --from=builder /app/src/server/db/migrations ./src/server/db/migrations

COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p /app/data

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
