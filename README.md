# KING CODER

Bengali-friendly AI coding assistant prototype using Cloudflare Workers, Gemini, and GitHub OAuth.

## Current capabilities
- Responsive Bengali chat UI and Gemini API proxy.
- GitHub OAuth login with one-time state validation.
- OAuth tokens encrypted at rest in D1 using AES-GCM; HttpOnly, Secure, SameSite=Lax session cookies.
- List repositories, generate a proposed code change using the current branch files as context, review/edit the preview, and create a user-approved commit containing up to 20 files (1 MB total).
- Writes are restricted to repositories owned by the connected GitHub username.
- This is an early code-generation workflow, not a fully autonomous coding agent: it has no isolated code execution sandbox, automatic test runner, persistent project history, or multi-step agent loop. Generated changes are proposals; the user must review and explicitly approve each commit.

## GitHub OAuth setup (Cloudflare)
1. Create a D1 database and execute `migrations/0001_github_oauth.sql` in its Console.
2. Add a D1 binding named `DB` to the Worker.
3. Create a GitHub OAuth App. Authorization callback URL:
   `https://mysocial2.mdmamunhossenlimon7.workers.dev/api/github/callback`
4. Add Production Worker secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, The OAuth client secret is used as the HKDF root to derive the AES-GCM token-encryption key; no extra encryption secret is needed.
5. Keep the existing `GEMINI_API_KEY` secret. Redeploy after adding bindings/secrets.
6. Open `/api/github/login` on the live site to connect.

The OAuth app requests `repo` and `read:user` permissions so it can write to private repositories. Review the GitHub consent page. Disconnecting clears this browser session; revoke the OAuth App under GitHub Settings → Applications to revoke its grant.

## API
- `GET /api/github/login`, `GET /api/github/callback`
- `GET /api/github/status`, `GET /api/github/repos`
- `POST /api/code/generate` (authenticated; reads up to 8 small text files from the selected branch and returns a JSON proposal).\n- `POST /api/github/commit` (authenticated; same-origin only; rejects workflow-file paths) with JSON: `{"owner":"your-login","repo":"project","branch":"main","message":"Add files","files":[{"path":"index.html","content":"..."}]}`
- `POST /api/github/disconnect`

## Safety
Never put secrets in browser code, Git, or chat. Add explicit user confirmation, audit logs, quotas, a code execution sandbox and automated tests before enabling public autonomous operation. Free-tier quotas and model availability can change.
