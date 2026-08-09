/*
 * The generated service map, checked against itself.
 *
 * `services.generated.ts` is 500 lines emitted from core, and the rest of
 * this suite trusts it completely — `client.test.ts` loops over
 * SERVICE_NAMESPACE to prove every service is addressed correctly, which
 * proves nothing if the map itself is wrong. These tests are the offline half
 * of that gap: the map has to be internally coherent. The other half — that
 * it matches the live catalogue — is `tests/contract/`.
 *
 * Everything here reads `dist/`, plus the generated source for the parts that
 * are types and therefore absent at runtime.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENTITIES,
  ENTITY_SERVICES,
  PLATFORMS,
  PLATFORM_SERVICES,
  SERVICE_INPUT_KIND,
  SERVICE_METHODS,
  SERVICE_NAMESPACE,
  SUBJECTS,
} from "../dist/index.js";

const slugs = Object.keys(SERVICE_NAMESPACE).sort();

/**
 * `ServiceOptionsMap` is a type, so it does not survive to `dist/`. Read it
 * out of the generated source instead — the file is machine-written, so its
 * shape is stable, and a parse failure here means the generator changed and
 * this test needs to change with it.
 */
export function optionsMapFromSource(): Map<string, string[]> {
  const src = readFileSync(new URL("../src/services.generated.ts", import.meta.url), "utf8");

  const start = src.indexOf("export interface ServiceOptionsMap {");
  assert.notEqual(start, -1, "ServiceOptionsMap not found — did the generator change?");
  const block = src.slice(start, src.indexOf("\n}", start));

  const byService = new Map<string, string[]>();
  for (const [, slug, type] of block.matchAll(/^ {2}"([^"]+)":\s*(.+);$/gm)) {
    byService.set(slug, type === "Record<string, never>" ? [] : propsOf(src, type));
  }
  assert.ok(byService.size > 0, "parsed no entries out of ServiceOptionsMap");
  return byService;
}

/** Property names of one generated options interface. */
function propsOf(src: string, typeName: string): string[] {
  const start = src.indexOf(`export interface ${typeName} {`);
  assert.notEqual(start, -1, `interface ${typeName} not found`);
  const block = src.slice(start, src.indexOf("\n}", start));
  return [...block.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

/** "post.comments" → "postComments", the generator's naming rule. */
function toMethodName(service: string): string {
  return service
    .split(".")
    .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join("");
}

// ─── Subjects ────────────────────────────────────────────

test("subjects are exactly the platforms plus the entities, with no overlap", () => {
  assert.deepEqual([...SUBJECTS].sort(), [...PLATFORMS, ...ENTITIES].sort());
  const overlap = PLATFORMS.filter((p) => (ENTITIES as readonly string[]).includes(p));
  assert.deepEqual(overlap, [], "a subject cannot be both a platform and an entity");
});

test("every subject declares at least one service", () => {
  for (const subject of SUBJECTS) {
    const services =
      subject in PLATFORM_SERVICES
        ? PLATFORM_SERVICES[subject as keyof typeof PLATFORM_SERVICES]
        : ENTITY_SERVICES[subject as keyof typeof ENTITY_SERVICES];
    assert.ok(services?.length, `subject "${subject}" has no service`);
  }
});

// ─── One slug set, four maps ─────────────────────────────

test("the per-subject service lists and the slug maps describe the same set", () => {
  const fromLists: string[] = [];
  for (const [platform, services] of Object.entries(PLATFORM_SERVICES)) {
    for (const service of services as readonly string[]) fromLists.push(`${platform}/${service}`);
  }
  for (const [entity, services] of Object.entries(ENTITY_SERVICES)) {
    for (const service of services as readonly string[]) fromLists.push(`${entity}/${service}`);
  }
  assert.deepEqual(fromLists.sort(), slugs);
});

test("namespace, input kind and method maps all cover exactly that set", () => {
  assert.deepEqual(Object.keys(SERVICE_INPUT_KIND).sort(), slugs);

  const fromMethods: string[] = [];
  for (const [subject, methods] of Object.entries(SERVICE_METHODS)) {
    for (const service of Object.values(methods as Record<string, string>)) {
      fromMethods.push(`${subject}/${service}`);
    }
  }
  assert.deepEqual(fromMethods.sort(), slugs);
});

test("the options map covers exactly that set too", () => {
  // A service dropped from core but left in ServiceOptionsMap types an
  // `options` bag for something no longer callable.
  assert.deepEqual([...optionsMapFromSource().keys()].sort(), slugs);
});

// ─── Values ──────────────────────────────────────────────

test("a slug's namespace follows its subject, never the other way round", () => {
  // The whole point of the namespace map: entities enrich, platforms extract.
  // Getting this wrong is the bug the suite was written for.
  for (const [slug, namespace] of Object.entries(SERVICE_NAMESPACE)) {
    const subject = slug.split("/")[0];
    const expected = (ENTITIES as readonly string[]).includes(subject) ? "enrich" : "extract";
    assert.equal(namespace, expected, slug);
  }
});

test("every slug has a known input kind", () => {
  for (const [slug, kind] of Object.entries(SERVICE_INPUT_KIND)) {
    assert.ok(["url", "query", "identifier"].includes(kind), `${slug}: ${kind}`);
  }
});

test("slugs are well formed: one slash, non-empty halves", () => {
  for (const slug of slugs) {
    const parts = slug.split("/");
    assert.equal(parts.length, 2, slug);
    assert.ok(parts[0] && parts[1], slug);
    assert.ok((SUBJECTS as readonly string[]).includes(parts[0]), `unknown subject in ${slug}`);
  }
});

// ─── Method names ────────────────────────────────────────

test("method names are derived from the service name, not hand-picked", () => {
  for (const [subject, methods] of Object.entries(SERVICE_METHODS)) {
    for (const [method, service] of Object.entries(methods as Record<string, string>)) {
      assert.equal(method, toMethodName(service), `${subject}.${method}`);
    }
  }
});

test("no two services of a subject collapse onto one method name", () => {
  for (const [subject, methods] of Object.entries(SERVICE_METHODS)) {
    const services = Object.values(methods as Record<string, string>);
    assert.equal(new Set(services).size, services.length, `${subject} has a duplicate service`);
  }
});
