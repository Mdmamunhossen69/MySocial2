# KING CODER

A Bengali-first AI website builder running on Cloudflare Workers, Gemini, GitHub OAuth, and D1.

## Capabilities
- Gemini chat in Bengali and English, enabled only after the owner explicitly verifies the linked Google AI Studio project is on the Free tier.
- GitHub OAuth with encrypted tokens and HttpOnly sessions.
- Select an owned repository or let KING CODER create a new private repository.
- Describe a website or provide a public HTTPS reference URL.
- Generate a complete project manifest and show a signed, read-only preview before any GitHub write.
- Render generated HTML in an isolated sandboxed live preview; local CSS and JavaScript are embedded when possible, while network requests, external frames and form submissions are blocked.
- After explicit approval, create a separate `king-coder/build-*` branch and a Pull Request; do not write directly to the default branch.
- Cloudflare publishing is manual and approval-gated; no automatic live deployment is triggered by this workflow.
- Pull-request review and manual code proposal flow remain available.

## Autonomous website creation
1. Connect GitHub in the KING CODER UI.
2. Keep “নতুন private repository তৈরি করো” selected, or choose one of your own repositories.
3. Describe the website or include a public HTTPS URL in the prompt.
4. Press “Preview তৈরি ও পরীক্ষা” to generate a proposed project. No repository is changed at this stage.
5. Review the signed, read-only preview. Only the exact files covered by its short-lived approval token can be committed after explicit approval; KING CODER creates a separate feature branch and Pull Request.
6. Review the Pull Request and merge it yourself. Live deployment is not automatic.

The generated project's manual deploy workflow can publish to Cloudflare Workers only when you manually run its `workflow_dispatch` action and the GitHub repository has both Actions secrets:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with permission to deploy Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.

For this KING CODER Worker itself, `.github/workflows/deploy-worker.yml` runs after an approved change is merged into `main`, and also supports manual `workflow_dispatch`. It checks JavaScript syntax and verifies existing Cloudflare secrets before deploying; if credentials are missing, it exits without deployment. Pull requests run the quality checks first. Do not paste tokens into chat or commit them to the repository.

## Cloudflare Worker configuration
- D1 binding: `DB`
- D1 database: `king-coder-db`
- Required Worker secrets: `GEMINI_API_KEY`, `GITHUB_CLIENT_SECRET`
- Required Worker variable: `GITHUB_CLIENT_ID`
- Gemini model variable: `GEMINI_MODEL`
- Safety variable: `GEMINI_API_BILLING_STATUS` (must equal `verified_free` to allow Gemini API requests; if unset, all Gemini API calls are blocked)

GitHub OAuth callback:
`https://mysocial2.mdmamunhossenlimon7.workers.dev/api/github/callback`

## API
- `GET /api/health`
- `GET /api/github/login`, `GET /api/github/callback`
- `GET /api/github/status`, `GET /api/github/repos`
- `POST /api/build` (Gemini project preview only; no GitHub writes)
- `POST /api/build/commit` (after explicit approval, creates a feature branch and Pull Request)
- `GET /api/ai/team` (provider status, daily usage and cost-policy status)
- `POST /api/code/generate` (review-first code proposal)
- `POST /api/github/commit` (user-approved code commit)
- `POST /api/github/disconnect`

## Limits and safety
- Current autonomous generator creates at most 20 files and 350 KB per project.
- Only repositories owned by the connected GitHub username can be updated.
- Reference URLs must use public HTTPS hostnames. For safety, the Worker never fetches user-supplied reference URLs; it only passes the URL as a design hint to Gemini. This removes redirect and private-network SSRF exposure.
- Preview approval tokens are HMAC-signed with the existing GitHub OAuth client secret, bound to the user, target repository, summary and exact file contents, and expire after 10 minutes.
- Website Build quota is consumed only after request, URL and target repository validation; malformed requests do not consume the daily quota.
- Repository contents and fetched reference text are treated as untrusted input.
- Generated code is tested in GitHub Actions; a successful build does not guarantee every feature is bug-free.
- Cloudflare free-plan limits and Gemini model availability may change.


## AI team and cost safeguards
- Gemini API requests are blocked by default until the owner verifies the exact Google AI Studio project is on the Free tier and explicitly sets `GEMINI_API_BILLING_STATUS=verified_free` in Worker variables.
- A Gemini API key alone does not prove Free-tier status. Do not set the verification variable based on assumptions or the existence of a key.
- Codex CLI and Google Antigravity CLI require a local computer/terminal and account OAuth; Cloudflare Workers cannot execute these local CLI programs. ChatGPT Free Codex access is not treated as a Worker API key.
- No Claude paid API or automatic paid-provider fallback is configured.
- Existing daily quotas are shown in the AI Team panel. The Worker cannot verify whether the Google Gemini API project has billing enabled; confirm billing status in Google Cloud/AI Studio before assuming API calls are free.
- Task history is stored locally in the browser and is not a server-wide audit log.
- Gemini's manager/inspector review is a single-pass static self-review. The sandboxed preview provides a visual rendering, but it is not a full automated cross-browser or authenticated end-to-end test.
- Google retired consumer free access to the old Gemini CLI on June 18, 2026; Antigravity CLI (`agy`) is the supported individual-account replacement. Its Free plan has weekly baseline quotas. Set AI-credit overages to Never/off where available. Neither CLI is connected to the Worker until a local agent bridge and user OAuth are completed.
- Existing daily limits are 100 chats, 5 website previews and 20 code proposals per user. These limits are application controls, not proof of Google free-tier eligibility.
