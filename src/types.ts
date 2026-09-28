import type {
  InputKindOf,
  ServiceName,
  ServiceOptionsMap,
  ServiceSlug,
  Subject,
} from "./services.generated.js";

export type {
  Entity,
  Namespace,
  Platform,
  ServiceName,
  ServiceSlug,
  ServiceOptionsMap,
  Subject,
} from "./services.generated.js";

export type ExtractionStatus = "pending" | "completed" | "failed";

/**
 * What a service consumes: a URL per record, a free-text query, or an
 * identifier of the entity — an email, a domain, a profile URL, a
 * provider-side id. The identifier kind is what makes "I have 500 emails,
 * give me LinkedIn URLs" expressible.
 */
export type InputKind = "url" | "query" | "identifier";

/**
 * A public offer id: `source/name`, e.g. `"apify/harshmaur"` or
 * `"brightdata/reddit"`. Which offers serve a service is a live property of
 * the catalogue (`listServices()`), not of this SDK release — the shape is
 * typed, the set is not.
 */
export type OfferId = `${string}/${string}`;

// ─── Running a service ───────────────────────────────────

/**
 * The `options` field of a run: optional, unless the service declares an
 * option it cannot run without (`linkedin/job.search` needs `location`) —
 * the API answers such a call with `missing_option` before routing, so the
 * type refuses it first.
 */
export type RunOptions<S extends ServiceSlug> = Record<string, never> extends ServiceOptionsMap[S]
  ? {
      /**
       * Typed options declared by the service. Unknown keys are rejected by
       * the API with a corrective 400 — they are not silently dropped.
       */
      options?: ServiceOptionsMap[S];
    }
  : {
      /**
       * Typed options declared by the service. At least one is required
       * here. Unknown keys are rejected by the API with a corrective 400.
       */
      options: ServiceOptionsMap[S];
    };

/** Fields every run accepts, whatever the service, `options` aside. */
export interface RunBase {
  /**
   * Pin one offer, e.g. `"apify/harshmaur"`. Omit it — the default — to let
   * the router pick and fail over across the whole chain. Pinning disables
   * failover: the run succeeds or fails on that offer alone.
   */
  provider?: OfferId;
  /** Max records to return, 1..250. Defaults to 100. */
  limit?: number;
}

/** Fields every run accepts, `options` typed for the service. */
export type RunCommon<S extends ServiceSlug = ServiceSlug> = RunBase & RunOptions<S>;

/** Inputs of a url-kind service. Pass `url` or `urls`, not both. */
export interface UrlInput {
  url?: string;
  urls?: string[];
}

/** Inputs of a query-kind service. Pass `query` or `queries`, not both. */
export interface QueryInput {
  query?: string;
  queries?: string[];
}

/**
 * Inputs of an identifier-kind service. Pass `identifier` or `identifiers`,
 * not both.
 *
 * Each entry is any handle you happen to hold for the entity — an email, a
 * domain, a LinkedIn URL, a provider-side id. They can be mixed in one call.
 */
export interface IdentifierInput {
  identifier?: string;
  identifiers?: string[];
}

/**
 * The body of `run(service, input)`, correlated with the service: a url-kind
 * service takes `url`/`urls`, a query-kind one takes `query`/`queries`, an
 * identifier-kind one takes `identifier`/`identifiers`, and `options` is the
 * option set that service declares.
 */
export type RunInput<S extends ServiceSlug> = RunCommon<S> &
  (InputKindOf<S> extends "query"
    ? QueryInput
    : InputKindOf<S> extends "identifier"
      ? IdentifierInput
      : UrlInput);

// ─── Results ─────────────────────────────────────────────

export interface ExtractionRecord {
  [key: string]: unknown;
}

/** A service run — the result of `run()` or `getExtraction()`. */
export interface Extraction {
  id: string;
  status: ExtractionStatus;
  /** The left key of the service slug: a platform, or an enrichment entity. */
  platform: Subject;
  service: ServiceName;
  /** The primary input (first URL, query or identifier). */
  url: string;
  /** Populated for query-kind services — the original list of queries. */
  queries?: string[];
  /**
   * The offer that actually served the run, e.g. `"apify/harshmaur"` — the
   * failover made visible. Null when no offer succeeded.
   */
  served_by: string | null;
  /**
   * Set only when the chain rolled over: the offer that was tried first.
   * `served_by` then holds the one that answered.
   */
  fallback_from?: string;
  /**
   * Which provider account the run was placed on: `"platform"`
   * (SocialRouter's, paid in credits) or `"own"` (a key you registered on
   * your account, invoiced to you by the provider directly).
   *
   * A failover chain can mix the two, so `served_by` alone does not answer
   * it. Present on every completed run returned by `run()`; not returned by
   * `getExtraction()`.
   */
  billed_as?: "platform" | "own";
  credits_used: number;
  data: ExtractionRecord[];
  pagination: {
    total: number;
    returned: number;
  };
  error?: ApiErrorDetail;
  created_at: string;
  completed_at: string | null;
}

// ─── Catalogue ───────────────────────────────────────────

/** One accepted input shape of a service. */
export interface InputFormat {
  /** Canonical shape, e.g. `"https://www.linkedin.com/in/<handle>"`. */
  format: string;
  /** A concrete valid input. */
  example: string;
  /** Validation regex source — informational; the API validates. */
  pattern?: string;
  note?: string;
  /**
   * Offers that accept this shape, e.g. `["apify/apimaestro"]`. Absent means
   * every offer of the service does. Pinning an offer outside this list for
   * an input of this shape is refused with `offer_cannot_serve_input`.
   */
  offers?: string[];
}

/** One typed option a service accepts. */
export interface ServiceOption {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  /** Allowed values, for `enum`. */
  values?: string[];
  /** Value shape hint for `string`, e.g. `"YYYY-MM-DD"`. */
  format?: string;
  description: string;
  default?: string | number | boolean;
  /**
   * The call cannot run without this option. The API answers a call that
   * omits it with `missing_option`.
   */
  required?: boolean;
  /** A concrete valid value, published for required options. */
  example?: string | number | boolean;
  /**
   * Offers that implement this option, e.g. `["apify/harshmaur"]`. Absent
   * means every offer of the service honours it. The others ignore it, and
   * pinning one of them with this option set is refused with
   * `option_not_supported_by_offer`.
   */
  offers?: string[];
}

/** One offer of a service, customer-facing. */
export interface CatalogueOffer {
  /** Public offer id, e.g. `"apify/harshmaur"`. */
  offer: string;
  /** The source half of the offer id, e.g. `"apify"`. */
  source: string;
  /**
   * What SocialRouter bills per record. Zero when `requires_own_key` is
   * true: the records are collected on your own provider account and
   * invoiced there, so there is nothing for us to resell.
   */
  price_per_record: number;
  /** Max inputs (URLs or queries) accepted per request. */
  max_inputs: number;
  /**
   * True when SocialRouter holds no account for this source, so the offer
   * only runs on a provider key you registered yourself. Stated on every
   * offer, not just the ones needing a key, so it never has to be inferred
   * from an absent field.
   */
  requires_own_key: boolean;
}

/** One (subject, service) entry of the catalogue, as `GET /v1/services`. */
export interface CatalogueService {
  /** The left key of the service slug: a platform, or an enrichment entity. */
  platform: Subject;
  service: ServiceName;
  /** The endpoint that runs this service, namespace included. */
  endpoint: string;
  input_kind: InputKind;
  /** Name of the request body field carrying the inputs. */
  input_field: "urls" | "queries" | "identifiers";
  accepts: InputFormat[];
  options: ServiceOption[];
  /** Offers in failover order — the head serves unless one is pinned. */
  offers: CatalogueOffer[];
}

export type SourceStatus = "active" | "degraded" | "down" | "coming_soon";

/** A data source, as `GET /v1/providers` — the "our sources" view. */
export interface SourceInfo {
  id: string;
  name: string;
  description: string;
  status: SourceStatus;
  /** Subjects this source serves — platforms and enrichment entities alike. */
  platforms: Subject[];
  services_count: number;
  offers_count: number;
}

// ─── Account ─────────────────────────────────────────────

export interface AccountBalance {
  balance: number;
  currency: string;
}

export interface UsageSummary {
  /** The window, e.g. `"30d"`. */
  period: string;
  total_requests: number;
  total_records: number;
  total_credits: number;
  /** Keyed by offer id, e.g. `"apify/harshmaur"`. */
  by_provider: Record<string, { requests: number; records: number; credits: number }>;
  by_platform: Record<string, { requests: number; records: number; credits: number }>;
}

/**
 * The `error` envelope of every failing response.
 *
 * `code`, `message` and `type` are always there. Validation errors add the
 * fields that make them correctable — `valid_options`, `allowed_values`,
 * `invalid_inputs`, `available_offers`, `did_you_mean`… — and a run placed on
 * your own provider key adds `provider_detail`, the provider's own wording.
 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  /**
   * Class of failure: `validation`, `auth`, `billing`, `rate_limit`,
   * `not_found`, `routing`, `timeout`, `provider`, `api_error`, `internal`,
   * `server`.
   */
  type: string;
  /** The provider's own error message, on a run placed on your own key. */
  provider_detail?: string;
  /** The option a validation error is about. */
  option?: string;
  /** Valid option names, on `unknown_option`. */
  valid_options?: string[];
  /** Valid values, on `invalid_option` and `invalid_byok_mode`. */
  allowed_values?: string[];
  /** The inputs that failed, on `invalid_input_format` and `offer_cannot_serve_input`. */
  invalid_inputs?: string[];
  /** Offers that would accept the call, on option/input-by-offer errors. */
  offers_supporting?: string[];
  /** Offers serving the service, on `unknown_offer`. */
  available_offers?: string[];
  /** Closest valid slug, on `unknown_service`. */
  did_you_mean?: string;
  /** Sources a credential can be registered for, on `unknown_source`. */
  valid_sources?: string[];
  /** Sources open to bring-your-own-key, on `source_not_byok_enabled`. */
  byok_sources?: string[];
  [key: string]: unknown;
}

// ─── Bring your own key ──────────────────────────────────

/**
 * Which provider account a run is placed on when both could serve it:
 * `own_first` (your key, else SocialRouter credits), `platform_first`,
 * `own_only` (never spend credits), `platform_only` (never use your key).
 */
export type ByokMode = "own_first" | "platform_first" | "own_only" | "platform_only";

/** The account's billing preferences, as `GET /v1/account/byok-mode`. */
export interface ByokModeSettings {
  /** The account default. */
  byok_mode: ByokMode;
  /**
   * Sources that depart from the default, keyed by source id. A source
   * absent here follows `byok_mode`.
   */
  source_modes: Record<string, ByokMode>;
  /** Every mode the API accepts. */
  available_modes: ByokMode[];
  /** Sources a provider key can be registered for. */
  byok_sources: string[];
  /** Sources SocialRouter holds no account for: reachable only with your key. */
  byok_only_sources: string[];
}

/**
 * A provider credential registered on the account. The token itself is
 * write-only and never returned, in whole or in part.
 */
export interface ProviderCredential {
  id: string;
  /** Source id, the first half of an offer id: `"apify"`, `"brightdata"`. */
  source: string;
  label: string | null;
  /** `invalid` once the provider has refused it during a run. */
  status: "active" | "invalid";
  last_verified_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

/** What `DELETE /v1/account/credentials/{source}` answers. */
export interface CredentialRevocation {
  revoked: true;
  source: string;
  id: string;
}

/**
 * Which SocialRouter surface issued the request. Sent on every call via the
 * `X-SocialRouter-Client` header so the API can attribute usage per channel.
 * Wrappers set this explicitly (CLI → "cli", MCP → "mcp"); a bare SDK caller
 * defaults to "sdk". A raw HTTP caller sends no header and the API records it
 * as "api".
 */
export type SourceClient = "sdk" | "cli" | "mcp" | "playground";

export interface SocialRouterConfig {
  apiKey: string;
  baseUrl?: string;
  /**
   * Identifies the calling surface for usage attribution. Defaults to "sdk".
   * The CLI and MCP server override this so requests can be traced to the
   * channel they came from.
   */
  client?: SourceClient;
}
