#!/bin/sh
set -e

echo "Starting pricing tool server..."
HOST=0.0.0.0 PORT=3000 exec node .output/server/index.mjs
