/**
 * Generate `src/services.generated.ts` from the live catalogue.
 *
 * `GET /v1/services` publishes everything this file needs — the slug, the
 * endpoint it is called at, the input kind and field, and every typed option
 * with its enum values, format, default and prose. That endpoint is public
 * and free, so the SDK can describe itself without reaching into the private
 * core package it must never depend on.
 *
 *   npm run gen:services
 *
 * Generating from the deployed API rather than from a registry is deliberate:
 * the SDK can only honestly advertise what the API actually serves. A service
 * that exists in core but is not deployed yet would type-check in a
 * customer's editor and 404 at runtime.
 *
 * Point it elsewhere with SOCIALROUTER_BASE_URL.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = (process.env.SOCIALROUTER_BASE_URL ?? "https://api.socialrouter.io").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/services.generated.ts");

type Namespace = "extract" | "enrich";
type InputKind = "url" | "query" | "identifier";

interface CatalogueOption {
  name: string;
  type: string;
  values?: string[];
  format?: string;
  default?: unknown;
  description: string;
}

interface CatalogueService {
  platform: string;
  service: string;
  endpoint: string;
  input_kind: InputKind;
  options?: CatalogueOption[];
}

// ─── Fetch ──────────────────────────────────────────────

const response = await fetch(`${BASE}/v1/services`);
if (!response.ok) {
  throw new Error(`GET ${BASE}/v1/services — ${response.status} ${response.statusText}`);
}
const body = (await response.json()) as { data: CatalogueService[] };
const catalogue = body.data;
if (!Array.isArray(catalogue) || catalogue.length === 0) {
  // A generator that happily writes an empty vocabulary is how every service
  // becomes uncallable in one commit.
  throw new Error(`no services returned by ${BASE}/v1/services`);
}

// ─── Naming ─────────────────────────────────────────────

/** "subreddit.posts" → "subredditPosts" — the SDK method name. */
function methodName(service: string): string {
  return service
    .split(".")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/** ("reddit", "subreddit.posts") → "RedditSubredditPostsOptions". */
function optionsTypeName(platform: string, service: string): string {
  const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return pascal(platform) + pascal(methodName(service)) + "Options";
}

/**
 * The namespace a service is called under, read off the endpoint the API
 * publishes rather than guessed from the subject. The SDK used to build
 * every path as `/v1/extract/...`, which made every enrichment service
 * silently uncallable; taking it from the catalogue means a third namespace
 * needs no edit here either.
 */
function namespaceOf(endpoint: string): Namespace {
  const segment = endpoint.split("/")[2];
  if (segment === "extract") return "extract";
  if (segment === "enrich") return "enrich";
  throw new Error(`unknown namespace in endpoint "${endpoint}"`);
}

function tsType(opt: CatalogueOption): string {
  if (opt.type === "enum") {
    return (opt.values ?? []).map((v) => JSON.stringify(v)).join(" | ") || "string";
  }
  return opt.type;
}

function jsdoc(opt: CatalogueOption, indent: string): string {
  const bits = [opt.description];
  if (opt.format) bits.push(`Format: ${opt.format}.`);
  if (opt.default !== undefined) bits.push(`Default: ${JSON.stringify(opt.default)}.`);
  return `${indent}/** ${bits.join(" ")} */`;
}

// ─── Collect ────────────────────────────────────────────

interface Entry {
  platform: string;
  service: string;
  method: string;
  kind: InputKind;
  namespace: Namespace;
  options: CatalogueOption[];
  optionsType: string | null;
}

const entries: Entry[] = catalogue
  .map((s) => {
    const options = s.options ?? [];
    return {
      platform: s.platform,
      service: s.service,
      method: methodName(s.service),
      kind: s.input_kind,
      namespace: namespaceOf(s.endpoint),
      options,
      optionsType: options.length ? optionsTypeName(s.platform, s.service) : null,
    };
  })
  .sort((a, b) => a.platform.localeCompare(b.platform) || a.service.localeCompare(b.service));

/** Every subject with at least one implemented service, both namespaces. */
const subjects = [...new Set(entries.map((e) => e.platform))].sort();

const namespaceBySubject = new Map(entries.map((e) => [e.platform, e.namespace]));

// ─── Emit ───────────────────────────────────────────────

const L: string[] = [];
const push = (line = "") => L.push(line);

/** Emit a `subject: [service, …]` block for a set of subjects. */
function pushServiceMap(name: string, doc: string, only: Namespace) {
  const picked = subjects.filter((s) => namespaceBySubject.get(s) === only);
  push(`/** ${doc} */`);
  push(`export const ${name} = {`);
  for (const subject of picked) {
    push(`  ${subject}: [`);
    for (const e of entries.filter((x) => x.platform === subject)) {
      push(`    ${JSON.stringify(e.service)},`);
    }
    push("  ],");
  }
  push("} as const;");
  push("");
}

push("// ─── GENERATED FILE — DO NOT EDIT ────────────────────────");
push("//");
push("// Source of truth: the live catalogue at GET /v1/services.");
push("// Regenerate with `npm run gen:services`.");
push("//");
push("// Only services served by at least one offer are listed: calling one");
push("// that isn't would type-check here and 404 at the API.");
push("");

// The two vocabularies, kept apart because their left key means different
// things — a platform that arbitrates what is true, versus an entity nothing
// arbitrates. That is also what decides the URL namespace.
pushServiceMap("PLATFORM_SERVICES", "Every callable extraction service, by platform.", "extract");
pushServiceMap("ENTITY_SERVICES", "Every callable enrichment service, by entity.", "enrich");

push("export type Platform = keyof typeof PLATFORM_SERVICES;");
push("export type Entity = keyof typeof ENTITY_SERVICES;");
push("");
push("/** The left key of a service slug: a platform, or an enrichment entity. */");
push("export type Subject = Platform | Entity;");
push("");
push("export const PLATFORMS = Object.keys(PLATFORM_SERVICES) as Platform[];");
push("export const ENTITIES = Object.keys(ENTITY_SERVICES) as Entity[];");
push("export const SUBJECTS: Subject[] = [...PLATFORMS, ...ENTITIES];");
push("");
push("/**");
push(" * Service names valid on a given subject (or across all subjects).");
push(" *");
push(" * Conditional rather than one indexed access: the two vocabularies live");
push(' * in separate consts, so `ServiceName<"linkedin">` resolves against');
push(' * PLATFORM_SERVICES and `ServiceName<"person">` against ENTITY_SERVICES.');
push(" */");
push("export type ServiceName<S extends Subject = Subject> = S extends Platform");
push("  ? (typeof PLATFORM_SERVICES)[S][number]");
push("  : S extends Entity");
push("    ? (typeof ENTITY_SERVICES)[S][number]");
push("    : never;");
push("");
push('/** A service, as passed to `run()`: "reddit/subreddit.posts", "person/info". */');
push("export type ServiceSlug = {");
push("  [S in Subject]: `${S}/${ServiceName<S>}`;");
push("}[Subject];");
push("");

// Namespaces — the URL prefix, published by the API and never guessed.
push("/** The API namespace a service is called under. */");
push('export type Namespace = "extract" | "enrich";');
push("");
push("/**");
push(" * The namespace of every callable service.");
push(" *");
push(" * The SDK builds request paths from this map rather than a hardcoded");
push(" * prefix. It used to hardcode `/v1/extract/`, which made every");
push(" * enrichment service silently uncallable.");
push(" */");
push("export const SERVICE_NAMESPACE = {");
for (const e of entries) {
  push(`  "${e.platform}/${e.service}": ${JSON.stringify(e.namespace)},`);
}
push("} as const satisfies Record<ServiceSlug, Namespace>;");
push("");

// Input kinds
push("/**");
push(" * What each service consumes: a URL per record, a free-text query, or an");
push(" * identifier of the entity (an email, a domain, a profile URL, an id).");
push(" */");
push("export const SERVICE_INPUT_KIND = {");
for (const e of entries) {
  push(`  "${e.platform}/${e.service}": ${JSON.stringify(e.kind)},`);
}
push('} as const satisfies Record<ServiceSlug, "url" | "query" | "identifier">;');
push("");
push("export type InputKindOf<S extends ServiceSlug> = (typeof SERVICE_INPUT_KIND)[S];");
push("");

// Method map
push("/**");
push(" * Method name per service, for the typed per-subject accessors:");
push(' * `sr.reddit.subredditPosts(...)` runs "reddit/subreddit.posts", and');
push(' * `sr.person.info(...)` runs "person/info".');
push(" */");
push("export const SERVICE_METHODS = {");
for (const subject of subjects) {
  push(`  ${subject}: {`);
  for (const e of entries.filter((x) => x.platform === subject)) {
    push(`    ${e.method}: ${JSON.stringify(e.service)},`);
  }
  push("  },");
}
push("} as const;");
push("");

// Option interfaces
push("// ─── Typed options, per service ──────────────────────────");
push("");
for (const e of entries) {
  if (!e.optionsType) continue;
  push(`/** Options accepted by \`${e.platform}/${e.service}\`. */`);
  push(`export interface ${e.optionsType} {`);
  for (const opt of e.options) {
    push(jsdoc(opt, "  "));
    push(`  ${opt.name}?: ${tsType(opt)};`);
  }
  push("}");
  push("");
}

push("/**");
push(" * Options type per service. Services that declare none map to an empty");
push(" * object — passing any key is a compile error, matching the API, which");
push(" * rejects unknown options with a corrective 400 rather than ignoring them.");
push(" */");
push("export interface ServiceOptionsMap {");
for (const e of entries) {
  push(`  "${e.platform}/${e.service}": ${e.optionsType ?? "Record<string, never>"};`);
}
push("}");
push("");

writeFileSync(OUT, L.join("\n"), "utf8");

const byNamespace = (n: Namespace) =>
  new Set(entries.filter((e) => e.namespace === n).map((e) => e.platform)).size;
console.log(
  `✓ src/services.generated.ts — ${entries.length} services across ` +
    `${byNamespace("extract")} platforms and ${byNamespace("enrich")} entities, from ${BASE}`,
);
