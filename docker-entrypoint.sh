#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate

echo "Starting pricing tool server..."
HOST=0.0.0.0 PORT=3000 exec node .output/server/index.mjs
