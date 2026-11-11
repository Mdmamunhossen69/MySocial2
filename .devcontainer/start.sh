#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
if pgrep -f '^node .*agent-canvas' >/dev/null 2>&1; then
  echo "Agent Canvas process already running."
  exit 0
fi

nohup agent-canvas > /tmp/agent-canvas.log 2>&1 < /dev/null &
echo "Started Agent Canvas in background. Logs: /tmp/agent-canvas.log"
