#!/bin/bash
# Start RoboMemoClaw backend
# Usage: bash start.sh [--ngrok]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Install deps if venv missing
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo "Starting claw_server on :8000..."
uvicorn claw_server:app --host 0.0.0.0 --port 8000 --reload &
SERVER_PID=$!

if [ "$1" == "--ngrok" ]; then
  echo "Starting ngrok tunnel..."
  ngrok http 8000
fi

wait $SERVER_PID
