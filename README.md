# KING CODER

A Bengali-first AI website builder running on Cloudflare Workers, Gemini, GitHub OAuth, and D1.

## Capabilities
- Gemini chat in Bengali and English.
- GitHub OAuth with encrypted tokens and HttpOnly sessions.
- Select an owned repository or let KING CODER create a new private repository.
- Describe a website or provide a public HTTPS reference URL.
- Generate a complete project manifest, commit files to GitHub, and add a GitHub Actions workflow for dependency installation, tests, build, and Wrangler dry-run validation.
- Pull-request review and manual code proposal flow remain available.

## Autonomous website creation
1. Connect GitHub in the KING CODER UI.
2. Keep “নতুন private repository তৈরি করো” selected, or choose one of your own repositories.
3. Describe the website or include a public HTTPS URL in the prompt.
4. Press “পাঠান” (website creation requests are automatically routed to the build workflow), or press “সম্পূর্ণ তৈরি ও পরীক্ষা”.
5. KING CODER creates the project and commits it. GitHub Actions then installs dependencies, runs available tests/build scripts, and validates Wrangler configuration.

The generated project's deploy workflow publishes to Cloudflare Workers only when the GitHub repository has both Actions secrets:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with permission to deploy Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.

For this KING CODER Worker itself, the repository's `.github/workflows/ci.yml` also deploys the existing Worker on pushes to `main` when those same two GitHub Actions secrets exist. Without them, CI can run but deployment is skipped. Do not paste tokens into chat or commit them to the repository.

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
