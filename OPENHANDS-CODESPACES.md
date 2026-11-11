# KING CODER — OpenHands Agent Canvas (Codespaces test)

This is an isolated, experimental setup. It does not replace or delete the existing MySocial2 Worker, D1 database, or production branch.

## Environment

- GitHub Codespaces dev container
- Node.js 24
- uv
- OpenHands Agent Canvas from the official npm package
- Private forwarded port 8000

## First start

Create or rebuild a Codespace from branch `feature/openhands-agent-canvas-codespaces`.
The dev container installs the official `@openhands/agent-canvas` package and starts it on port 8000.

Open the forwarded private port labelled **KING CODER — OpenHands Agent Canvas**.
If it does not open automatically, use the Ports tab and open port 8000.

## Logs and restart

In the Codespaces terminal:

```bash
tail -n 100 /tmp/agent-canvas.log
bash .devcontainer/start.sh
```

## Important safety and cost limits

- This branch is only a test; do not merge it into `main` until it has been reviewed and tested.
- The Codespace is a VM boundary, but Agent Canvas' default local backend is not a separate Docker sandbox. Treat agent commands as untrusted and do not place production secrets in the workspace.
- Configure only a model/provider with a verified free allowance. Do not add a payment method or enable paid usage. Stop using the model when its free quota is exhausted.
- GitHub Free personal accounts currently include 120 Codespaces core-hours and 15 GB-month storage. A 2-core Codespace consumes 2 core-hours per running hour (up to 60 runtime hours if the full compute allowance is unused). Stop the Codespace when finished. Usage beyond the allowance can be billed if a payment method is on file.
- Codespaces may stop when idle; this is not a 24/7 hosting service.
- OpenHands Agent Canvas requires Node.js 24+ and uv. Mobile/Termux is not its primary supported target; this setup uses the Codespaces Linux VM instead.

Official setup guide: https://github.com/OpenHands/docs/blob/main/openhands/usage/agent-canvas/setup.mdx
