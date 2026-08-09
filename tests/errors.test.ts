/*
 * How a failing response becomes a typed error.
 *
 * This is the surface every caller meets on a bad day and it had no test at
 * all: the status→class mapping, the `error` envelope the API sends, and the
 * fallback for a response that is not JSON (a proxy's HTML 502 reaches the
 * SDK exactly like an API error does).
 *
 * Run against `dist/`, like the rest of this suite.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  SocialRouter,
  SocialRouterError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
} from "../dist/index.js";

const BASE = "https://api.test";
const realFetch = globalThis.fetch;

/** Answer every request with one status, body and header set. */
function stubStatus(
  status: number,
  body: unknown,
  init: { headers?: Record<string, string>; statusText?: string } = {},
) {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      statusText: init.statusText,
      headers: { "content-type": "application/json", ...init.headers },
    })) as typeof fetch;
}

const sr = () => new SocialRouter({ apiKey: "sr_test", baseUrl: BASE });

const detail = (code: string, type: string, message: string) => ({
  error: { code, message, type },
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// ─── The status → class mapping ──────────────────────────

test("401 becomes an AuthenticationError carrying the API's detail", async () => {
  stubStatus(401, detail("invalid_api_key", "authentication_error", "API key not found"));
  await assert.rejects(
    () => sr().getBalance(),
    (err: AuthenticationError) => {
      assert.ok(err instanceof AuthenticationError);
      assert.ok(err instanceof SocialRouterError, "stays catchable as the base class");
      assert.equal(err.name, "AuthenticationError");
      assert.equal(err.status, 401);
      assert.equal(err.code, "invalid_api_key");
      assert.equal(err.type, "authentication_error");
      assert.equal(err.message, "API key not found");
      return true;
    },
  );
});

test("402 becomes an InsufficientCreditsError", async () => {
  stubStatus(402, detail("insufficient_credits", "billing_error", "Balance too low"));
  await assert.rejects(
    () => sr().run("reddit/subreddit.posts", { url: "https://www.reddit.com/r/x" }),
    (err: InsufficientCreditsError) => {
      assert.ok(err instanceof InsufficientCreditsError);
      assert.equal(err.status, 402);
      assert.equal(err.code, "insufficient_credits");
      return true;
    },
  );
});

test("429 becomes a RateLimitError", async () => {
  stubStatus(429, detail("rate_limited", "rate_limit_error", "Too many requests"), {
    headers: { "X-RateLimit-Reset": "1786000000" },
  });
  await assert.rejects(
    () => sr().getBalance(),
    (err: RateLimitError) => {
      assert.ok(err instanceof RateLimitError);
      assert.equal(err.status, 429);
      // NOTE: the API sends X-RateLimit-Reset as a Unix timestamp in seconds
      // (api middleware/rate-limit.ts), and the SDK stores it verbatim under a
      // field named `retryAfter`. This asserts what the code does today, not
      // what the name promises — a caller doing `retryAfter * 1000` in a
      // setTimeout waits forever. Fix the semantics (or the name) and this
      // expectation is the one to change.
      assert.equal(err.retryAfter, 1786000000);
      return true;
    },
  );
});

test("429 without the reset header leaves retryAfter undefined", async () => {
  stubStatus(429, detail("rate_limited", "rate_limit_error", "Too many requests"));
  await assert.rejects(
    () => sr().getBalance(),
    (err: RateLimitError) => {
      assert.equal(err.retryAfter, undefined);
      return true;
    },
  );
});

test("any other status becomes a SocialRouterError keeping that status", async () => {
  for (const status of [400, 404, 422, 500, 503]) {
    stubStatus(status, detail("boom", "api_error", `failed with ${status}`));
    await assert.rejects(
      () => sr().getBalance(),
      (err: SocialRouterError) => {
        assert.equal(err.constructor, SocialRouterError, `status ${status}`);
        assert.equal(err.status, status);
        assert.equal(err.message, `failed with ${status}`);
        return true;
      },
    );
  }
});

// ─── Bodies the API did not write ────────────────────────

test("a non-JSON error body falls back to the status text", async () => {
  // A proxy or edge timeout answers with HTML; parsing it must not replace
  // the real failure with a JSON syntax error.
  stubStatus(502, "<html><body>Bad Gateway</body></html>", {
    statusText: "Bad Gateway",
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(
    () => sr().getBalance(),
    (err: SocialRouterError) => {
      assert.equal(err.status, 502);
      assert.equal(err.code, "unknown");
      assert.equal(err.type, "unknown");
      assert.equal(err.message, "Bad Gateway");
      return true;
    },
  );
});

test("a JSON error body with no 'error' envelope falls back too", async () => {
  stubStatus(500, { message: "oops" }, { statusText: "Internal Server Error" });
  await assert.rejects(
    () => sr().getBalance(),
    (err: SocialRouterError) => {
      assert.equal(err.code, "unknown");
      assert.equal(err.message, "Internal Server Error");
      return true;
    },
  );
});

test("an empty body on an error status is survivable", async () => {
  stubStatus(504, "", { statusText: "Gateway Timeout" });
  await assert.rejects(
    () => sr().getBalance(),
    (err: SocialRouterError) => {
      assert.equal(err.status, 504);
      assert.equal(err.code, "unknown");
      return true;
    },
  );
});
