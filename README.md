# KING CODER

A Bengali-first AI website builder running on Cloudflare Workers, Gemini, GitHub OAuth, and D1.

## Capabilities
- Gemini chat in Bengali and English.
- GitHub OAuth with encrypted tokens and HttpOnly sessions.
- Select an owned repository or let KING CODER create a new private repository.
- Describe a website or provide a public HTTPS reference URL.
- Generate a complete project manifest and show an editable preview before any GitHub write.
- After explicit approval, create a separate `king-coder/build-*` branch and a Pull Request; do not write directly to the default branch.
- Cloudflare publishing is manual and approval-gated; no automatic live deployment is triggered by this workflow.
- Pull-request review and manual code proposal flow remain available.

## Autonomous website creation
1. Connect GitHub in the KING CODER UI.
2. Keep “নতুন private repository তৈরি করো” selected, or choose one of your own repositories.
3. Describe the website or include a public HTTPS URL in the prompt.
4. Press “Preview তৈরি ও পরীক্ষা” to generate a proposed project. No repository is changed at this stage.
5. Review or edit the proposed files. Only after explicit approval does KING CODER create a private repository if needed, commit to a separate feature branch, and open a Pull Request.
6. Review the Pull Request and merge it yourself. Live deployment is not automatic.

The generated project's manual deploy workflow can publish to Cloudflare Workers only when you manually run its `workflow_dispatch` action and the GitHub repository has both Actions secrets:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with permission to deploy Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.

For this KING CODER Worker itself, `.github/workflows/deploy-worker.yml` is manually triggered only. It checks JavaScript syntax and existing Cloudflare secrets, then deploys only when you explicitly run the workflow. It never deploys on push or pull request. Do not paste tokens into chat or commit them to the repository.

## Cloudflare Worker configuration
- D1 binding: `DB`
- D1 database: `king-coder-db`
- Required Worker secrets: `GEMINI_API_KEY`, `GITHUB_CLIENT_SECRET`
- Required Worker variable: `GITHUB_CLIENT_ID`
- Gemini model variable: `GEMINI_MODEL`

GitHub OAuth callback:
`https://mysocial2.mdmamunhossenlimon7.workers.dev/api/github/callback`

## API
- `GET /api/health`
- `GET /api/github/login`, `GET /api/github/callback`
- `GET /api/github/status`, `GET /api/github/repos`
- `POST /api/build` (autonomous project generation and GitHub commit)
- `POST /api/code/generate` (review-first code proposal)
- `POST /api/github/commit` (user-approved code commit)
- `POST /api/github/disconnect`

## Limits and safety
- Current autonomous generator creates at most 20 files and 350 KB per project.
- Only repositories owned by the connected GitHub username can be updated.
- Reference URLs must be public HTTPS pages.
- Repository contents and fetched reference text are treated as untrusted input.
- Generated code is tested in GitHub Actions; a successful build does not guarantee every feature is bug-free.
- Cloudflare free-plan limits and Gemini model availability may change.


## AI team and cost safeguards
- Gemini is the configured cloud assistant and is assigned manager/inspection duties.
- Codex and Gemini CLI are reported as unavailable until a supported, user-authorized local agent connection exists; ChatGPT Free access is not treated as a Worker API key.
- No Claude paid API or automatic paid-provider fallback is configured.
- Existing daily quotas are shown in the AI Team panel. The Worker cannot verify whether the Google Gemini API project has billing enabled; confirm billing status in Google Cloud/AI Studio before assuming API calls are free.
- Task history is stored locally in the browser and is not a server-wide audit log.
