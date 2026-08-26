/*
 * The SDK against the real API.
 *
 * Everything in `tests/` stubs `fetch`, so it asserts that the SDK talks to
 * our *idea* of the API. The bug this suite was born from — every service
 * addressed under a hardcoded `/v1/extract/` — would have stayed green under
 * all of it, because the stub answered whatever path it was asked for. Only a
 * live call can say the two agree.
 *
 * Read-only by construction: the catalogue and the sources are public and
 * free, the account endpoints spend nothing, and `run()` is never called from
 * here — that one costs real provider credits.
 *
 * Fails loudly rather than skipping when the API is unreachable: a contract
 * test that quietly passes offline is worse than no contract test. Run the
 * offline suite alone with `npm run test:unit`.
 *
 * Set SOCIALROUTER_BASE_URL to point at another deployment; set
 * SOCIALROUTER_API_KEY to also cover the authenticated endpoints (a key is
 * not required for the catalogue half, which is where the drift shows up).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AuthenticationError,
  SocialRouterError,
  SERVICE_INPUT_KIND,
  SERVICE_NAMESPACE,
  SUBJECTS,
  SocialRouter,
  type CatalogueService,
} from "../../dist/index.js";

const BASE = (process.env.SOCIALROUTER_BASE_URL ?? "https://api.socialrouter.io").replace(/\/$/, "");
const KEY = process.env.SOCIALROUTER_API_KEY;
const NO_KEY = "SOCIALROUTER_API_KEY not set — authenticated contract not covered";

/** The catalogue is public, so an invalid key is enough to read it. */
const anon = new SocialRouter({ apiKey: "sr_contract_test_invalid", baseUrl: BASE });
const authed = KEY ? new SocialRouter({ apiKey: KEY, baseUrl: BASE }) : null;

const live: CatalogueService[] = await anon.listServices();
const liveBySlug = new Map(live.map((s) => [`${s.platform}/${s.service}`, s]));
const generatedSlugs = Object.keys(SERVICE_NAMESPACE);

const INPUT_FIELD = { url: "urls", query: "queries", identifier: "identifiers" } as const;

// ─── The generated map vs the live catalogue ─────────────

test("the catalogue is not empty", () => {
  // Guards every set comparison below: two empty sets are equal.
  assert.ok(live.length > 0, `no services at ${BASE}`);
  assert.ok(generatedSlugs.length > 0, "services.generated.ts is empty");
});

test("the SDK offers exactly the services the API serves", () => {
  const missing = [...liveBySlug.keys()].filter((s) => !generatedSlugs.includes(s));
  const stale = generatedSlugs.filter((s) => !liveBySlug.has(s));
  assert.deepEqual(
    { missing, stale },
    { missing: [], stale: [] },
    "services.generated.ts has drifted from the live catalogue — regenerate it with `npm run gen:sdk` from packages/core",
  );
});

test("the path the SDK builds is the endpoint the API publishes", () => {
  // The regression, checked against the source of truth instead of a fixture:
  // `run()` composes the endpoint from SERVICE_NAMESPACE, and the catalogue
  // states it outright. `enrich` carries no service segment — an entity has
  // exactly one service, so the URL doesn't name it.
  for (const [slug, service] of liveBySlug) {
    const namespace = SERVICE_NAMESPACE[slug as keyof typeof SERVICE_NAMESPACE];
    const expected =
      namespace === "enrich" ? `/v1/enrich/${slug.split("/")[0]}` : `/v1/${namespace}/${slug}`;
    assert.equal(service.endpoint, expected, slug);
  }
});

test("the input kind the SDK types matches the one the API declares", () => {
  for (const [slug, service] of liveBySlug) {
    assert.equal(service.input_kind, SERVICE_INPUT_KIND[slug as keyof typeof SERVICE_INPUT_KIND], slug);
  }
});

test("the body field run() picks is the one the API expects", () => {
  // `run()` chooses urls/queries/identifiers from the input kind; the
  // catalogue names the field per service. They must agree service by
  // service, not just kind by kind.
  for (const [slug, service] of liveBySlug) {
    assert.equal(service.input_field, INPUT_FIELD[service.input_kind], slug);
  }
});

test("every subject the API serves is a subject the SDK knows", () => {
  for (const [slug, service] of liveBySlug) {
    assert.ok((SUBJECTS as readonly string[]).includes(service.platform), `${slug}: ${service.platform}`);
    assert.equal(service.platform, slug.split("/")[0], slug);
  }
});

// ─── Typed options vs declared options ───────────────────

/**
 * `ServiceOptionsMap` is a type and does not reach `dist/`; read it out of
 * the generated source. Same parser as `generated.test.ts` — duplicated
 * rather than shared so neither file has to import TypeScript at runtime.
 */
function optionsMapFromSource(): Map<string, string[]> {
  const src = readFileSync(new URL("../../src/services.generated.ts", import.meta.url), "utf8");
  const start = src.indexOf("export interface ServiceOptionsMap {");
  assert.notEqual(start, -1, "ServiceOptionsMap not found — did the generator change?");
  const block = src.slice(start, src.indexOf("\n}", start));

  const byService = new Map<string, string[]>();
  for (const [, slug, type] of block.matchAll(/^ {2}"([^"]+)":\s*(.+);$/gm)) {
    if (type === "Record<string, never>") {
      byService.set(slug, []);
      continue;
    }
    const at = src.indexOf(`export interface ${type} {`);
    assert.notEqual(at, -1, `interface ${type} not found`);
    const body = src.slice(at, src.indexOf("\n}", at));
    byService.set(slug, [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]));
  }
  return byService;
}

test("each service types exactly the options the API accepts", () => {
  // The API rejects an unknown option with a 400 instead of ignoring it, so a
  // stale name here is a call that cannot succeed — and a missing one is a
  // capability nobody can reach through the SDK.
  const typed = optionsMapFromSource();
  const drift: Record<string, { typed: string[]; live: string[] }> = {};

  for (const [slug, service] of liveBySlug) {
    const declared = service.options.map((o) => o.name).sort();
    const known = (typed.get(slug) ?? []).sort();
    if (JSON.stringify(declared) !== JSON.stringify(known)) {
      drift[slug] = { typed: known, live: declared };
    }
  }
  assert.deepEqual(drift, {}, "option names have drifted from the live catalogue");
});

test("every enum option's values are all typed", () => {
  const src = readFileSync(new URL("../../src/services.generated.ts", import.meta.url), "utf8");
  for (const [slug, service] of liveBySlug) {
    for (const option of service.options) {
      if (option.type !== "enum" || !option.values?.length) continue;
      // The property's union is emitted on one line as `name?: "a" | "b";`.
      const line = src.match(new RegExp(`^ {2}${option.name}\\?:.*$`, "m"));
      assert.ok(line, `${slug}: no typed property for enum option "${option.name}"`);
      for (const value of option.values) {
        assert.ok(line[0].includes(`"${value}"`), `${slug}.${option.name}: "${value}" not typed`);
      }
    }
  }
});

// ─── The response shapes the SDK's types promise ─────────

test("a catalogue entry has every field CatalogueService declares", () => {
  for (const [slug, s] of liveBySlug) {
    assert.equal(typeof s.platform, "string", slug);
    assert.equal(typeof s.service, "string", slug);
    assert.equal(typeof s.endpoint, "string", slug);
    assert.ok(Array.isArray(s.accepts), slug);
    assert.ok(Array.isArray(s.options), slug);
    assert.ok(Array.isArray(s.offers) && s.offers.length > 0, `${slug}: no offer`);

    for (const accept of s.accepts) {
      assert.equal(typeof accept.format, "string", slug);
      assert.equal(typeof accept.example, "string", slug);
    }
    for (const option of s.options) {
      assert.ok(["string", "number", "boolean", "enum"].includes(option.type), `${slug}.${option.name}`);
      assert.equal(typeof option.description, "string", `${slug}.${option.name}`);
    }
    for (const offer of s.offers) {
      assert.match(offer.offer, /^[^/]+\/[^/]+$/, `${slug}: offer id is not source/name`);
      assert.equal(offer.source, offer.offer.split("/")[0], slug);
      assert.equal(typeof offer.price_per_record, "number", slug);
      assert.ok(Number.isInteger(offer.max_inputs) && offer.max_inputs > 0, slug);
      // Declared non-optional on CatalogueOffer, precisely so callers never
      // have to infer BYOK from an absent field.
      assert.equal(typeof offer.requires_own_key, "boolean", `${slug}: ${offer.offer}`);
    }
  }
});

test("listServices filters server-side on a subject", () => {
  // Not a smoke test: the filter is a different route (/v1/services/{subject})
  // and it is how the CLI and the MCP narrow the catalogue.
  const subject = live[0].platform;
  return anon.listServices({ platform: subject }).then((filtered) => {
    assert.ok(filtered.length > 0);
    assert.deepEqual([...new Set(filtered.map((s) => s.platform))], [subject]);
  });
});

test("getService returns the same entry as the collection", async () => {
  const [slug, fromList] = [...liveBySlug][0];
  const one = await anon.getService(slug as never);
  assert.equal(`${one.platform}/${one.service}`, slug);
  assert.equal(one.endpoint, fromList.endpoint);
  assert.equal(one.input_kind, fromList.input_kind);
});

test("a source has every field SourceInfo declares", async () => {
  const sources = await anon.listSources();
  assert.ok(sources.length > 0, "no sources");
  for (const s of sources) {
    assert.equal(typeof s.id, "string");
    assert.equal(typeof s.name, "string");
    assert.equal(typeof s.description, "string");
    assert.ok(["active", "degraded", "down", "coming_soon"].includes(s.status), `${s.id}: ${s.status}`);
    assert.ok(Number.isInteger(s.services_count) && Number.isInteger(s.offers_count), s.id);
    for (const subject of s.platforms) {
      assert.ok((SUBJECTS as readonly string[]).includes(subject), `${s.id} serves unknown subject ${subject}`);
    }
  }

  const one = await anon.getSource(sources[0].id);
  assert.equal(one.id, sources[0].id);
});

test("every source backing an offer is listed as a source", async () => {
  const known = new Set((await anon.listSources()).map((s) => s.id));
  for (const [slug, service] of liveBySlug) {
    for (const offer of service.offers) {
      assert.ok(known.has(offer.source), `${slug}: offer ${offer.offer} has no source entry`);
    }
  }
});

// ─── The error contract ──────────────────────────────────

test("a rejected key produces an AuthenticationError, envelope and all", async () => {
  // The mapping is unit-tested against a stubbed envelope; this pins that the
  // API still sends that envelope, with a 401 rather than a 403 or a 200.
  await assert.rejects(
    () => anon.getBalance(),
    (err: AuthenticationError) => {
      assert.ok(err instanceof AuthenticationError, `got ${err?.constructor?.name}`);
      assert.equal(err.status, 401);
      assert.ok(err.code.length > 0, "no error code");
      assert.ok(err.type.length > 0, "no error type");
      assert.ok(err.message.length > 0, "no error message");
      return true;
    },
  );
});

test("an unknown service 404s with the same envelope", async () => {
  await assert.rejects(
    () => anon.getService("reddit/definitely.not.a.service" as never),
    (err: SocialRouterError) => {
      assert.ok(err instanceof SocialRouterError);
      assert.equal(err.status, 404);
      assert.ok(err.code.length > 0);
      return true;
    },
  );
});

// ─── Authenticated, still free ───────────────────────────

test("getBalance matches AccountBalance", { skip: authed ? false : NO_KEY }, async () => {
  const balance = await authed!.getBalance();
  assert.equal(typeof balance.balance, "number");
  assert.equal(typeof balance.currency, "string");
});

test("getUsage matches UsageSummary and honours the window", { skip: authed ? false : NO_KEY }, async () => {
  const usage = await authed!.getUsage(7);
  assert.equal(typeof usage.period, "string");
  for (const field of ["total_requests", "total_records", "total_credits"] as const) {
    assert.equal(typeof usage[field], "number", field);
  }
  for (const bucket of [usage.by_provider, usage.by_platform]) {
    assert.equal(typeof bucket, "object");
    for (const [key, row] of Object.entries(bucket)) {
      assert.equal(typeof row.requests, "number", key);
      assert.equal(typeof row.records, "number", key);
      assert.equal(typeof row.credits, "number", key);
    }
  }
});

test("an unknown extraction id 404s rather than returning an empty run", { skip: authed ? false : NO_KEY }, async () => {
  await assert.rejects(
    () => authed!.getExtraction("ext_contract_test_does_not_exist"),
    (err: SocialRouterError) => {
      assert.ok(err instanceof SocialRouterError);
      assert.equal(err.status, 404);
      return true;
    },
  );
});
