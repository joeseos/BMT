#!/bin/sh
set -e

echo "Running migrations..."
node scripts/migrate.mjs

echo "Running database seed..."
node scripts/seed.mjs

echo "Starting pricing tool server..."
HOST=0.0.0.0 PORT=3000 exec node .output/server/index.mjs
