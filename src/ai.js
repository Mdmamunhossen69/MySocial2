const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function getGeminiQuotaState(env) {
  if (!env.DB) return { blocked: false, blockedUntil: 0, reason: "" };
  try {
    const row = await env.DB.prepare("SELECT blocked_until,reason FROM gemini_provider_state WHERE id=1").first();
    const blockedUntil = Number(row?.blocked_until || 0);
    return { blocked: blockedUntil > Date.now(), blockedUntil, reason: row?.reason || "" };
  } catch {
    return { blocked: false, blockedUntil: 0, reason: "" };
  }
}

function quotaCooldownUntil(payload, now = Date.now()) {
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
  const retry = details.find(item => String(item?.["@type"] || "").endsWith("RetryInfo"));
  const value = String(retry?.retryDelay || "");
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  const delay = match ? Math.max(60_000, Number(match[1]) * 1000) : DEFAULT_QUOTA_COOLDOWN_MS;
  return now + Math.min(delay, DEFAULT_QUOTA_COOLDOWN_MS);
}

async function rememberQuotaExhaustion(env, payload) {
  if (!env.DB) return;
  const blockedUntil = quotaCooldownUntil(payload);
  const reason = String(payload?.error?.status || "RESOURCE_EXHAUSTED").slice(0, 80);
  try {
    await env.DB.prepare("INSERT INTO gemini_provider_state(id,blocked_until,reason,updated_at) VALUES(1,?1,?2,?3) ON CONFLICT(id) DO UPDATE SET blocked_until=MAX(gemini_provider_state.blocked_until,excluded.blocked_until),reason=excluded.reason,updated_at=excluded.updated_at")
      .bind(blockedUntil, reason, Date.now()).run();
  } catch {
    // Never turn a provider quota response into a paid fallback or a retry loop.
  }
}

/**
 * Calls the already-configured Gemini model.
 * Retries only transient network/5xx failures; quota/auth/client errors are never retried.
 * Does not introduce another provider, API key, secret, or paid fallback.
 */
export async function generateGemini({ env, systemInstruction, contents, generationConfig }) {
  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
  // Fail closed until the owner verifies this exact project is on the Free tier.
  if (env.GEMINI_API_BILLING_STATUS !== "verified_free") {
    const blocked = { error: { message: "Gemini API is blocked until the Google AI Studio project is verified as Free tier. No request was sent.", status: "BILLING_UNVERIFIED" } };
    return { response: new Response(JSON.stringify(blocked), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }), model, attempts: 0, blocked: true };
  }
  const quotaState = await getGeminiQuotaState(env);
  if (quotaState.blocked) {
    const blocked = { error: { message: "Gemini Free Tier-এর quota শেষ। অতিরিক্ত request পাঠানো বন্ধ রাখা হয়েছে; cooldown শেষ হলে আবার চেষ্টা করুন।", status: "RESOURCE_EXHAUSTED" }, retryAt: quotaState.blockedUntil };
    return { response: new Response(JSON.stringify(blocked), { status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }), model, attempts: 0, quotaBlocked: true, retryAt: quotaState.blockedUntil };
  }
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + ":generateContent";
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body
      });
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        return { response: null, model, attempts: attempt };
      }
      await wait(400 * attempt);
      continue;
    }

    if (response.status === 429) {
      const payload = await response.clone().json().catch(() => ({}));
      const retryAt = quotaCooldownUntil(payload);
      await rememberQuotaExhaustion(env, payload);
      return { response, model, attempts: attempt, quotaBlocked: true, retryAt };
    }
    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
      return { response, model, attempts: attempt };
    }

    try {
      await response.body?.cancel();
    } catch {
      // A failed response body must not prevent the bounded retry.
    }
    await wait(400 * attempt);
  }

  return { response: null, model, attempts: MAX_ATTEMPTS };
}
