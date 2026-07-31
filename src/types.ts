import type {
  InputKindOf,
  Platform,
  ServiceName,
  ServiceOptionsMap,
  ServiceSlug,
} from "./services.generated.js";

export type {
  Platform,
  ServiceName,
  ServiceSlug,
  ServiceOptionsMap,
} from "./services.generated.js";

export type ExtractionStatus = "pending" | "completed" | "failed";

/** What a service consumes: a URL per record, or a free-text query. */
export type InputKind = "url" | "query";

/**
 * A public offer id: `source/name`, e.g. `"apify/harshmaur"` or
 * `"brightdata/reddit"`. Which offers serve a service is a live property of
 * the catalogue (`listServices()`), not of this SDK release — the shape is
 * typed, the set is not.
 */
export type OfferId = `${string}/${string}`;

// ─── Running a service ───────────────────────────────────

/** Fields every run accepts, whatever the service. */
export interface RunCommon<S extends ServiceSlug = ServiceSlug> {
  /**
   * Pin one offer, e.g. `"apify/harshmaur"`. Omit it — the default — to let
   * the router pick and fail over across the whole chain. Pinning disables
   * failover: the run succeeds or fails on that offer alone.
   */
  provider?: OfferId;
  /** Max records to return, 1..250. Defaults to 100. */
  limit?: number;
  /**
   * Typed options declared by the service. Unknown keys are rejected by the
   * API with a corrective 400 — they are not silently dropped.
   */
  options?: ServiceOptionsMap[S];
}

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
 * The body of `run(service, input)`, correlated with the service: a url-kind
 * service takes `url`/`urls`, a query-kind one takes `query`/`queries`, and
 * `options` is the option set that service declares.
 */
export type RunInput<S extends ServiceSlug> = RunCommon<S> &
  (InputKindOf<S> extends "query" ? QueryInput : UrlInput);

// ─── Results ─────────────────────────────────────────────

export interface ExtractionRecord {
  [key: string]: unknown;
}

/** A service run — the result of `run()` or `getExtraction()`. */
export interface Extraction {
  id: string;
  status: ExtractionStatus;
  platform: Platform;
  service: ServiceName;
  /** The primary input (first URL or query). */
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
}

/** One offer of a service, customer-facing. */
export interface CatalogueOffer {
  /** Public offer id, e.g. `"apify/harshmaur"`. */
  offer: string;
  /** The source half of the offer id, e.g. `"apify"`. */
  source: string;
  price_per_record: number;
  /** Max inputs (URLs or queries) accepted per request. */
  max_inputs: number;
}

/** One (platform, service) entry of the catalogue, as `GET /v1/services`. */
export interface CatalogueService {
  platform: Platform;
  service: ServiceName;
  /** The endpoint that runs this service. */
  endpoint: string;
  input_kind: InputKind;
  /** Name of the request body field carrying the inputs. */
  input_field: "urls" | "queries";
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
  platforms: Platform[];
  services_count: number;
  offers_count: number;
}

// ─── Account ─────────────────────────────────────────────

export interface AccountBalance {
  balance: number;
  currency: string;
}

export interface UsageSummary {
  period: string;
  total_requests: number;
  total_records: number;
  total_credits: number;
  /** Keyed by offer id, e.g. `"apify/harshmaur"`. */
  by_provider: Record<string, { requests: number; records: number; credits: number }>;
  by_platform: Record<string, { requests: number; records: number; credits: number }>;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  type: string;
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
