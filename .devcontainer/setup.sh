#!/usr/bin/env bash
set -euo pipefail

echo "Installing uv (user-local)..."
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

echo "Installing OpenHands Agent Canvas..."
npm install -g @openhands/agent-canvas

echo "Checking prerequisites..."
node --version
npm --version
uv --version
agent-canvas --version || true

echo "Setup complete. Agent Canvas will start when the Codespace starts."
