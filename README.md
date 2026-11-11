# KING CODER

**Personal AI Engineer — AI chat starter**

A mobile-first Bengali-friendly AI coding assistant interface with a Cloudflare Worker backend.

## Included
- Responsive chat UI
- Server-side Gemini API proxy
- API key kept in a Cloudflare Worker secret (never in browser code)
- Basic request validation, bounded conversation history, health endpoint
- Honest prototype limits: no terminal, code execution, GitHub agent, or automatic deployment tools yet

## Deploy on Cloudflare Workers (free tier subject to quotas)
1. Create/sign in to a Cloudflare account.
2. From a computer or a mobile terminal with Node.js, clone this repository and run `npx wrangler login`.
3. From the repository folder run `npx wrangler secret put GEMINI_API_KEY`, then paste the key in the terminal prompt only. Never commit the key or send it in chat.
4. Deploy with `npx wrangler deploy`.
5. Open the Worker URL. Check `/api/health`; it should report `configured: true`.

You can create a Gemini API key in Google AI Studio: https://aistudio.google.com/app/apikey

## Local development
```sh
npx wrangler dev
```
Set a local secret with `npx wrangler secret put GEMINI_API_KEY` (Wrangler stores it in local development secrets).

## Model and free tier
Default model: `gemini-3.5-flash`. Availability, free quota and rate limits depend on the Google AI Studio project and can change. Check https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/rate-limits. Free usage is not unlimited.

## Security notes
- Never put the Gemini key in `index.html`, JavaScript shipped to browsers, or a public GitHub file.
- This starter does not yet implement user accounts, per-user quotas, persistent chat storage, tool execution, or abuse-resistant rate limiting. Do not expose it to heavy public traffic before adding those controls.
- The assistant cannot access GitHub or execute code from this Worker yet. It only generates conversational responses.
