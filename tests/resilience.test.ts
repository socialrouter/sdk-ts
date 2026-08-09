/*
 * What the SDK does when the response is not the happy path, and what
 * `run()` does with inputs no compiler ever saw.
 *
 * The typed surface only constrains TypeScript callers. The SDK ships
 * JavaScript, gets called from the CLI and the MCP with runtime values, and
 * `run()` takes a plain string for the service. These pin the behaviour on
 * that side of the boundary — including the places where it is currently
 * rough, so a change there is a decision rather than an accident.
 *
 * Run against `dist/`, like the rest of this suite.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SocialRouter, SocialRouterError } from "../dist/index.js";

const BASE = "https://api.test";
const realFetch = globalThis.fetch;

let calls: { url: string; body: Record<string, unknown> | undefined }[] = [];

function stubOk(payload: unknown = { id: "ext_1" }, contentType = "application/json") {
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url).replace(BASE, ""),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": contentType },
    });
  }) as typeof fetch;
}

const sr = () => new SocialRouter({ apiKey: "sr_test", baseUrl: BASE });

beforeEach(() => {
  calls = [];
  stubOk();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Transport-level failures — DNS, refused connections, dropped sockets —
// live in `network.test.ts`, against real sockets rather than a stub.

// ─── Success statuses with unusable bodies ───────────────

test("a 200 with an empty body fails at parse time", async () => {
  // The SDK casts `res.json()` straight to the declared type; an empty body
  // is a SyntaxError, not a typed error. Pinned so that adding a friendlier
  // message later is a visible change.
  stubOk("", "application/json");
  await assert.rejects(() => sr().getBalance(), { name: "SyntaxError" });
});

test("a 200 with an HTML body fails at parse time too", async () => {
  stubOk("<html>maintenance</html>", "text/html");
  await assert.rejects(() => sr().getBalance(), { name: "SyntaxError" });
});

test("a 200 whose JSON is not the declared shape passes straight through", async () => {
  // There is no runtime validation: the cast is blind, so a contract break
  // surfaces in caller code rather than here. Contract drift is caught by
  // tests/contract/, not by this layer.
  stubOk({ unexpected: true });
  assert.deepEqual(await sr().getBalance(), { unexpected: true } as never);
});

test("an envelope-less catalogue response yields undefined, not a crash", async () => {
  // `listServices()` returns `res.data`; if the envelope ever disappeared,
  // callers would get undefined rather than an error naming the cause.
  stubOk({ services: [] });
  assert.equal(await sr().listServices(), undefined as never);
});

// ─── run() with runtime inputs ───────────────────────────

test("urls wins over url when a caller passes both", async () => {
  // Unreachable through the types, reachable from JavaScript. The plural is
  // checked first in run(), and that order is what the API sees.
  await sr().run("reddit/subreddit.posts", {
    url: "https://www.reddit.com/r/single",
    urls: ["https://www.reddit.com/r/plural"],
  } as never);
  assert.deepEqual(calls[0].body, { urls: ["https://www.reddit.com/r/plural"] });
});

test("the input kinds are tried in a fixed order, plural before singular", async () => {
  await sr().run("person/info", {
    identifier: "ada@analytical.dev",
    identifiers: ["grace@analytical.dev"],
  } as never);
  assert.deepEqual(calls[0].body, { identifiers: ["grace@analytical.dev"] });
});

test("an empty input array is sent as-is, for the API to reject", async () => {
  // The SDK does not second-guess the input: the API owns validation and
  // returns the corrective message. Silently turning this into "no input
  // given" would report the wrong error.
  await sr().run("reddit/subreddit.posts", { urls: [] } as never);
  assert.deepEqual(calls[0].body, { urls: [] });
});

test("limit 0 is forwarded, not swallowed as falsy", async () => {
  // `if (src.limit)` instead of `!== undefined` would drop it and silently
  // apply the API's default of 100.
  await sr().run("reddit/subreddit.posts", {
    url: "https://www.reddit.com/r/x",
    limit: 0,
  } as never);
  assert.equal(calls[0].body!.limit, 0);
});

test("an empty options object is forwarded rather than dropped", async () => {
  await sr().run("reddit/subreddit.posts", {
    url: "https://www.reddit.com/r/x",
    options: {},
  } as never);
  assert.deepEqual(calls[0].body, { url: "https://www.reddit.com/r/x", options: {} });
});

test("a missing input never leaves the process, whatever the service", async () => {
  // The local throw exists so a caller gets a useful message instead of the
  // API's. It must hold for every input kind.
  for (const service of ["reddit/subreddit.posts", "googlemaps/place.search", "person/info"]) {
    await assert.rejects(() => sr().run(service as never, {} as never), /requires an input/);
  }
  assert.equal(calls.length, 0);
});

test("an explicitly undefined input counts as absent", async () => {
  await assert.rejects(
    () => sr().run("reddit/subreddit.posts", { url: undefined } as never),
    /requires an input/,
  );
});

test("a null input is forwarded, and only the API objects", async () => {
  // The check is `!== undefined`, so null passes it. A JavaScript caller
  // reading a URL out of an empty row sends `{"url": null}` and gets the
  // API's 400 rather than the local message. Pinned as the current
  // behaviour, not endorsed as the right one.
  await sr().run("reddit/subreddit.posts", { url: null } as never);
  assert.deepEqual(calls[0].body, { url: null });
});
