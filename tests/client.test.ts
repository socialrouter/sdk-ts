/*
 * What `run()` actually puts on the wire.
 *
 * This package had no tests, and the bug that followed is the reason it has
 * some now: `run()` built every path as `/v1/extract/${slug}`, so every
 * enrichment service was uncallable from the SDK, and therefore from the CLI
 * and the MCP too — with a body the API would have accepted. Nothing typed
 * caught it, because the slug was right and only the prefix was wrong.
 *
 * Run against `dist/`, not `src/`: that is the artefact customers install,
 * and it is the one place where a broken build or a stale generated file
 * shows up. `npm test` builds first for the same reason.
 *
 * No test framework — Node's own runner, so this package keeps installing
 * with nothing but TypeScript.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SocialRouter, SERVICE_NAMESPACE, SERVICE_INPUT_KIND } from "../dist/index.js";

const BASE = "https://api.test";

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}

let calls: Call[] = [];
const realFetch = globalThis.fetch;

function stubFetch(status = 200, payload: unknown = { id: "ext_1", status: "completed" }) {
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url).replace(BASE, ""),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const sr = () => new SocialRouter({ apiKey: "sr_test", baseUrl: BASE });

beforeEach(() => {
  calls = [];
  stubFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// ─── The namespace in the path ───────────────────────────

test("an extraction service is called under /v1/extract", async () => {
  await sr().run("reddit/subreddit.posts", { url: "https://www.reddit.com/r/programming" });
  assert.equal(calls[0].url, "/v1/extract/reddit/subreddit.posts");
});

test("an enrichment service is called under /v1/enrich", async () => {
  // The regression this file exists for.
  await sr().run("person/info", { identifiers: ["ada@analytical.dev"] });
  assert.equal(calls[0].url, "/v1/enrich/person/info");
});

test("no service is ever addressed under a hardcoded prefix", async () => {
  // Every callable service, not a sample: the failure mode was one whole
  // namespace being wrong, which a single spot-check can miss.
  for (const [slug, namespace] of Object.entries(SERVICE_NAMESPACE)) {
    calls = [];
    const kind = SERVICE_INPUT_KIND[slug as keyof typeof SERVICE_INPUT_KIND];
    const input =
      kind === "query"
        ? { query: "x" }
        : kind === "identifier"
          ? { identifier: "x" }
          : { url: "https://example.com/x" };

    await sr().run(slug as never, input as never);
    assert.equal(calls[0].url, `/v1/${namespace}/${slug}`, slug);
  }
});

test("a slug this build does not know fails here, not as a 404", async () => {
  // The map is a build-time snapshot; the MCP server and the CLI validate
  // against the live catalogue. When an old SDK build meets a new slug the
  // lookup misses, and interpolating that miss shipped `/v1/undefined/...`
  // to the API — a 404 blaming the route instead of the stale dependency.
  await assert.rejects(
    () => sr().run("instagram/profile.telepathy" as never, { url: "https://example.com/x" } as never),
    /does not know that service/,
  );
  assert.equal(calls.length, 0, "an unknown slug must not reach the network");
});

test("path segments are encoded, so a slug cannot alter the target", async () => {
  // Not reachable through the typed surface, but `run()` takes a string at
  // runtime and the path is interpolated.
  await sr().run("reddit/subreddit.posts" as never, { url: "https://www.reddit.com/r/x" } as never);
  assert.ok(!calls[0].url.includes(".."));
});

// ─── The input field ─────────────────────────────────────

test("each input kind travels in its own body field", async () => {
  await sr().run("reddit/subreddit.posts", { urls: ["https://www.reddit.com/r/a"] });
  assert.deepEqual(calls[0].body, { urls: ["https://www.reddit.com/r/a"] });

  calls = [];
  await sr().run("googlemaps/place.search", { queries: ["pizza"] });
  assert.deepEqual(calls[0].body, { queries: ["pizza"] });

  calls = [];
  await sr().run("person/info", { identifiers: ["ada@analytical.dev"] });
  assert.deepEqual(calls[0].body, { identifiers: ["ada@analytical.dev"] });
});

test("the singular form is passed through as the singular field", async () => {
  // The API accepts both, and rewriting one into the other here would make
  // its error messages name a field the caller never sent.
  await sr().run("person/info", { identifier: "ada@analytical.dev" });
  assert.deepEqual(calls[0].body, { identifier: "ada@analytical.dev" });
});

test("an enrichment call with no input fails locally, naming all three forms", async () => {
  await assert.rejects(
    () => sr().run("person/info", {} as never),
    (err: Error) => {
      assert.match(err.message, /identifier'\/'identifiers/);
      return true;
    },
  );
  assert.equal(calls.length, 0, "nothing may leave the process");
});

test("provider, limit and options ride along untouched", async () => {
  await sr().run("person/info", {
    identifiers: ["ada@analytical.dev"],
    provider: "apollo/person",
    limit: 5,
    options: { revealPersonalEmails: true },
  });
  assert.deepEqual(calls[0].body, {
    identifiers: ["ada@analytical.dev"],
    provider: "apollo/person",
    limit: 5,
    options: { revealPersonalEmails: true },
  });
});

// ─── The typed accessors ─────────────────────────────────

test("the per-subject accessors exist for entities, not just platforms", async () => {
  const client = sr() as unknown as Record<string, Record<string, (i: unknown) => Promise<unknown>>>;

  await client.reddit.subredditPosts({ url: "https://www.reddit.com/r/programming" });
  assert.equal(calls[0].url, "/v1/extract/reddit/subreddit.posts");

  calls = [];
  await client.person.info({ identifiers: ["ada@analytical.dev"] });
  assert.equal(calls[0].url, "/v1/enrich/person/info");
});

// ─── Catalogue ───────────────────────────────────────────

test("listServices filters on an entity as readily as on a platform", async () => {
  stubFetch(200, { data: [] });
  await sr().listServices({ platform: "person" });
  assert.equal(calls[0].url, "/v1/services/person");
});
