const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calls the already-configured Gemini model.
 * Retries only transient network/5xx failures; quota/auth/client errors are never retried.
 * Does not introduce another provider, API key, secret, or paid fallback.
 */
export async function generateGemini({ env, systemInstruction, contents, generationConfig }) {
  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
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
