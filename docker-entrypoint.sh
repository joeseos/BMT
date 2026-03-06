#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate

echo "Starting pricing tool server..."
node .output/server/index.mjs
