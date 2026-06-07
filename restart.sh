#!/bin/bash
echo "Stopping any process on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

sleep 1

echo "Starting WHOOP Dashboard..."
cd "$(dirname "$0")"
npm start
