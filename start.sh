#!/usr/bin/env bash
set -e

echo "🎵 Starting Neotheatre Platform..."

# 1. Start Python conversion queue worker in background
echo "⚡ Starting Python Database Queue Worker..."
python3 processor/worker.py &
WORKER_PID=$!

# 2. Start Backend API Server (serves API & Frontend on http://localhost:4000)
echo "🚀 Starting Node.js API Server on http://localhost:4000..."
cd backend
node dist/server.js &
BACKEND_PID=$!

trap "echo 'Stopping Neotheatre...'; kill $WORKER_PID $BACKEND_PID 2>/dev/null || true; exit" INT TERM

wait
