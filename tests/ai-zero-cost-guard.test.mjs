import test from "node:test";
import assert from "node:assert/strict";
import { generateGemini } from "../src/ai.js";

test("blocks Gemini requests unless Free tier is explicitly verified", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("fetch must not run"); };
  try {
    const result = await generateGemini({
      env: { GEMINI_MODEL: "gemini-3.5-flash", GEMINI_API_KEY: "test-key", GEMINI_API_BILLING_STATUS: "unverified" },
      systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }]
    });
    assert.equal(result.blocked, true);
    assert.equal(result.attempts, 0);
    assert.equal(result.response.status, 503);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sends one request when Free tier is verified and provider succeeds", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let requestUrl = "";
  let requestHeaders;
  globalThis.fetch = async (url, options) => {
    calls++;
    requestUrl = String(url);
    requestHeaders = options.headers;
    return new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await generateGemini({
      env: { GEMINI_MODEL: "gemini-3.5-flash", GEMINI_API_KEY: "test-key", GEMINI_API_BILLING_STATUS: "verified_free" },
      systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }]
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.attempts, 1);
    assert.equal(calls, 1);
    assert.match(requestUrl, /gemini-3\.5-flash:generateContent$/);
    assert.equal(requestHeaders["x-goog-api-key"], "test-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not retry quota or authentication errors", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429 });
  };
  try {
    const result = await generateGemini({
      env: { GEMINI_MODEL: "gemini-3.5-flash", GEMINI_API_KEY: "test-key", GEMINI_API_BILLING_STATUS: "verified_free" },
      systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }]
    });
    assert.equal(result.response.status, 429);
    assert.equal(result.attempts, 1);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pauses Gemini after a Free-tier quota response and persists the cooldown", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let stored = null;
  const env = {
    GEMINI_MODEL: "gemini-3.5-flash",
    GEMINI_API_KEY: "test-key",
    GEMINI_API_BILLING_STATUS: "verified_free",
    DB: {
      prepare(sql) {
        return {
          first: async () => stored,
          bind(...values) {
            return { run: async () => { stored = { blocked_until: values[0], reason: values[1] }; } };
          }
        };
      }
    }
  };
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "daily quota exceeded" } }), { status: 429 });
  };
  try {
    const first = await generateGemini({ env, systemInstruction: "test", contents: [{ role: "user", parts: [{ text: "hello" }] }] });
    assert.equal(first.response.status, 429);
    assert.equal(first.quotaBlocked, true);
    assert.equal(calls, 1);
    const second = await generateGemini({ env, systemInstruction: "test", contents: [{ role: "user", parts: [{ text: "again" }] }] });
    assert.equal(second.response.status, 429);
    assert.equal(second.quotaBlocked, true);
    assert.equal(second.attempts, 0);
    assert.equal(calls, 1);
    assert.ok(stored.blocked_until > Date.now());
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("uses Groq fallback when Gemini Free quota is exhausted", async () => {
  const originalFetch = globalThis.fetch;
  let groqCalls = 0;
  let groqAuthorization = "";
  const env = {
    GEMINI_MODEL: "gemini-3.5-flash",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_API_BILLING_STATUS: "verified_free",
    GROQ_API_KEY: "test-groq-secret",
    DB: {
      prepare() {
        return { first: async () => ({ blocked_until: Date.now() + 60_000, reason: "RESOURCE_EXHAUSTED" }) };
      }
    }
  };
  globalThis.fetch = async (url, options) => {
    groqCalls++;
    assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
    groqAuthorization = options.headers.Authorization;
    return new Response(JSON.stringify({ choices: [{ message: { content: "Groq fallback answer" } }] }), { status: 200 });
  };
  try {
    const result = await generateGemini({
      env, systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      generationConfig: { maxOutputTokens: 100 }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.provider, "groq");
    assert.equal(result.model, "openai/gpt-oss-120b");
    assert.equal(groqCalls, 1);
    assert.equal(groqAuthorization, "Bearer test-groq-secret");
    const payload = await result.response.json();
    assert.equal(payload.candidates[0].content.parts[0].text, "Groq fallback answer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses Groq when Gemini is not verified, without calling Google", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Free Groq response" } }] }), { status: 200 });
  };
  try {
    const result = await generateGemini({
      env: { GEMINI_API_KEY: "test-key", GEMINI_API_BILLING_STATUS: "unverified", GROQ_API_KEY: "test-groq-secret" },
      systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }]
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.provider, "groq");
    assert.equal(requestedUrl, "https://api.groq.com/openai/v1/chat/completions");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("never attempts a paid provider when no verified free provider is configured", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("No provider should be called"); };
  try {
    const result = await generateGemini({
      env: { GEMINI_API_KEY: "test-key", GEMINI_API_BILLING_STATUS: "unverified" },
      systemInstruction: "test",
      contents: [{ role: "user", parts: [{ text: "hello" }] }]
    });
    assert.equal(result.response.status, 503);
    assert.equal(result.provider, "none");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("uses strict Groq JSON schema output for website manifests", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody;
  globalThis.fetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      repositoryName: "sample-site",
      summary: "A complete site",
      files: [{ path: "index.html", content: "<h1>Hello</h1>" }, { path: "package.json", content: "{}" }],
      testPlan: ["Check the homepage"]
    }) } }] }), { status: 200 });
  };
  try {
    const result = await generateGemini({
      env: { GROQ_API_KEY: "test-groq-secret" },
      systemInstruction: "Return only valid JSON.",
      contents: [{ role: "user", parts: [{ text: "Build a site" }] }],
      generationConfig: { maxOutputTokens: 16000, responseMimeType: "application/json" }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.provider, "groq");
    assert.equal(sentBody.reasoning_format, "hidden");
    assert.equal(sentBody.max_completion_tokens, 16000);
    assert.equal(sentBody.max_tokens, undefined);
    assert.equal(sentBody.response_format.type, "json_schema");
    assert.equal(sentBody.response_format.json_schema.strict, true);
    assert.deepEqual(sentBody.response_format.json_schema.schema.required,
      ["repositoryName", "summary", "files", "testPlan"]);
    assert.equal(sentBody.response_format.json_schema.schema.additionalProperties, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
