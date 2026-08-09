/*
 * The rest of the client surface: the endpoints `run()` does not cover, the
 * headers every request carries, and what the constructor does with its
 * config.
 *
 * `client.test.ts` pins the run path because that is where the namespace bug
 * lived; everything here was reachable by customers and asserted by nobody.
 *
 * Run against `dist/`, like the rest of this suite.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SocialRouter, SUBJECTS } from "../dist/index.js";
import { readFileSync } from "node:fs";

const BASE = "https://api.test";

interface Call {
  url: string;
  method: string;
  body: string | undefined;
  headers: Record<string, string>;
}

let calls: Call[] = [];
const realFetch = globalThis.fetch;

/** Record every request; answer all of them with `payload`. */
function stubFetch(payload: unknown = {}) {
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      body: init.body as string | undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

/** The recorded path, with the base URL stripped. */
const path = (i = 0) => calls[i].url.replace(BASE, "");

const sr = () => new SocialRouter({ apiKey: "sr_test", baseUrl: BASE });

beforeEach(() => {
  calls = [];
  stubFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// ─── Headers ─────────────────────────────────────────────

test("every request carries the key, the content type and the client tag", async () => {
  await sr().getBalance();
  const h = calls[0].headers;
  assert.equal(h.Authorization, "Bearer sr_test");
  assert.equal(h["Content-Type"], "application/json");
  assert.equal(h["X-SocialRouter-Client"], "sdk", "default client tag");
});

test("the client tag follows the config, so the API can attribute traffic", async () => {
  // The CLI and the MCP both construct the SDK with their own tag; if this
  // stopped being forwarded, all three would report as "sdk".
  await new SocialRouter({ apiKey: "sr_test", baseUrl: BASE, client: "mcp" }).getBalance();
  assert.equal(calls[0].headers["X-SocialRouter-Client"], "mcp");

  calls = [];
  await new SocialRouter({ apiKey: "sr_test", baseUrl: BASE, client: "cli" }).getBalance();
  assert.equal(calls[0].headers["X-SocialRouter-Client"], "cli");
});

test("the user agent names this SDK and a version", async () => {
  // Shape only, on purpose: the version in the header is a literal in
  // client.ts and currently trails package.json. Asserting equality here
  // would fail for a reason unrelated to what this file covers — the drift is
  // tracked separately.
  await sr().getBalance();
  assert.match(calls[0].headers["User-Agent"], /^socialrouter-sdk\/\d+\.\d+\.\d+$/);
});

test("a GET carries no body", async () => {
  await sr().getBalance();
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].method, "GET");
});

// ─── The constructor ─────────────────────────────────────

test("a trailing slash on the base URL does not double up in the path", async () => {
  await new SocialRouter({ apiKey: "sr_test", baseUrl: `${BASE}/` }).getBalance();
  assert.equal(calls[0].url, `${BASE}/v1/account/balance`);
});

test("with no base URL, requests go to the production API", async () => {
  await new SocialRouter({ apiKey: "sr_test" }).getBalance();
  assert.equal(calls[0].url, "https://api.socialrouter.io/v1/account/balance");
});

test("a plaintext base URL warns, because the key travels in a header", async () => {
  const realWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);
  try {
    new SocialRouter({ apiKey: "sr_test", baseUrl: "http://localhost:3000" });
  } finally {
    console.warn = realWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unencrypted/);
});

test("an https base URL warns about nothing", async () => {
  const realWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);
  try {
    new SocialRouter({ apiKey: "sr_test", baseUrl: BASE });
  } finally {
    console.warn = realWarn;
  }
  assert.equal(warnings.length, 0);
});

test("no subject accessor can shadow a method of the client", async () => {
  // The per-subject accessors are assigned onto `this` in a loop over
  // SUBJECTS. A platform or entity named `run`, `getBalance`… would overwrite
  // that method with a service map, silently.
  const methods = Object.getOwnPropertyNames(SocialRouter.prototype);
  for (const subject of SUBJECTS) {
    assert.ok(!methods.includes(subject), `subject "${subject}" shadows a client method`);
  }
});

// ─── Extractions ─────────────────────────────────────────

test("getExtraction fetches by id", async () => {
  await sr().getExtraction("ext_123");
  assert.equal(path(), "/v1/extractions/ext_123");
  assert.equal(calls[0].method, "GET");
});

test("an id cannot escape its path segment", async () => {
  // The id is interpolated into the URL, and callers pass through whatever
  // they were handed.
  await sr().getExtraction("../account/balance?x=1");
  assert.equal(path(), "/v1/extractions/..%2Faccount%2Fbalance%3Fx%3D1");
});

// ─── Catalogue ───────────────────────────────────────────

test("listServices unfiltered hits the collection and unwraps the envelope", async () => {
  stubFetch({ data: [{ service: "reddit/subreddit.posts" }] });
  const services = await sr().listServices();
  assert.equal(path(), "/v1/services");
  assert.deepEqual(services, [{ service: "reddit/subreddit.posts" }]);
});

test("getService addresses one service, slug segments intact", async () => {
  await sr().getService("reddit/subreddit.posts");
  assert.equal(path(), "/v1/services/reddit/subreddit.posts");
});

test("listSources reads the providers collection and unwraps it", async () => {
  stubFetch({ data: [{ id: "apify" }] });
  const sources = await sr().listSources();
  assert.equal(path(), "/v1/providers");
  assert.deepEqual(sources, [{ id: "apify" }]);
});

test("getSource encodes the source id", async () => {
  await sr().getSource("bright data/x");
  assert.equal(path(), "/v1/providers/bright%20data%2Fx");
});

// ─── Account ─────────────────────────────────────────────

test("getBalance reads the balance endpoint", async () => {
  stubFetch({ balance: 9.65, currency: "USD" });
  assert.deepEqual(await sr().getBalance(), { balance: 9.65, currency: "USD" });
  assert.equal(path(), "/v1/account/balance");
});

test("getUsage defaults to 30 days and honours an explicit window", async () => {
  await sr().getUsage();
  assert.equal(path(), "/v1/account/usage?days=30");

  calls = [];
  await sr().getUsage(7);
  assert.equal(path(), "/v1/account/usage?days=7");
});

// ─── The shipped artefact ────────────────────────────────

test("the built package exposes every entry point the README promises", async () => {
  // A generated file that failed to regenerate, or an export dropped from
  // index.ts, breaks consumers at import time — before any of the above runs.
  const mod = await import("../dist/index.js");
  for (const name of [
    "SocialRouter",
    "SocialRouterError",
    "AuthenticationError",
    "InsufficientCreditsError",
    "RateLimitError",
    "SERVICE_METHODS",
    "SERVICE_NAMESPACE",
    "SERVICE_INPUT_KIND",
    "SUBJECTS",
    "PLATFORMS",
    "ENTITIES",
  ]) {
    assert.ok(name in mod, `missing export: ${name}`);
  }
});

test("the package's main entry point is the file the tests exercise", async () => {
  // These tests import dist/index.js directly; this pins that npm ships the
  // same file, so a green suite is a statement about what customers install.
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { main: string; exports: Record<string, { import: string }> };
  assert.equal(pkg.main, "dist/index.js");
  assert.equal(pkg.exports["."].import, "./dist/index.js");
});
