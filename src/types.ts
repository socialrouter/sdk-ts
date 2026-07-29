export type Platform =
  | "linkedin"
  | "instagram"
  | "x"
  | "reddit"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "bluesky"
  | "snapchat"
  | "googlemaps";

export type ExtractionType =
  | "post.likes"
  | "post.comments"
  | "post.info"
  | "profile.info"
  | "profile.posts"
  | "profile.reels"
  | "profile.shorts"
  | "profile.followers"
  | "company.info"
  | "company.reviews"
  | "group.posts"
  | "job.listings"
  | "event.info"
  | "marketplace.listings"
  | "video.info"
  | "video.transcript"
  | "channel.info"
  | "playlist.posts"
  | "hashtag.posts"
  | "place.info"
  | "place.reviews";

export type SearchType = "place.search" | "video.search";

export type ServiceType = ExtractionType | SearchType;

export type ExtractionStatus = "pending" | "completed" | "failed";

export type ExtractionKind = "extract" | "search";

export type ProviderStatus = "active" | "degraded" | "down" | "coming_soon";

export interface ExtractOptions {
  /**
   * Single URL to extract from. Use `urls` for batch-capable providers when
   * sending more than one URL in a single request.
   */
  url?: string;
  /** Batch form — non-empty array of URLs. Mutually exclusive with `url`. */
  urls?: string[];
  /**
   * Service slug of the form `<provider>/<platform>/<type>[:<tag>]`
   * (e.g. `apify/linkedin/profile.info` or
   * `apify/linkedin/profile.posts:apimaestro`). The `:tag` suffix is optional
   * and selects a specific actor/dataset variant.
   */
  provider: string;
  limit?: number;
  /**
   * Whether to fall over to alternative providers if the requested one fails.
   * Defaults to `true`. Set to `false` to attempt only the requested provider
   * and surface its error directly.
   */
  fallback?: boolean;
  /**
   * Per-actor input overrides. Plain JSON object — each actor decides which
   * keys it honors via its `buildInput` allowlist (unknown keys are dropped
   * server-side). Use this for actor-specific knobs that don't have a
   * first-class slot in the request body (e.g. `{ includeEmail: false }` on
   * `apify/linkedin/profile.info`). The catalogue does not advertise which
   * keys an actor accepts — only pass keys documented for that actor.
   */
  options?: Record<string, unknown>;
}

export interface SearchOptions {
  /** Non-empty list of search queries (terms or context-pinning URLs). */
  queries: string[];
  /**
   * Service slug `<provider>/<platform>/<type>[:<tag>]` whose `type` belongs
   * to the SearchType union (e.g. `apify/googlemaps/place.search:compass`).
   */
  provider: string;
  limit?: number;
  /** Defaults to `true`. See `ExtractOptions.fallback`. */
  fallback?: boolean;
  /** Per-actor input overrides. See `ExtractOptions.options`. */
  options?: Record<string, unknown>;
}

export interface ExtractionRecord {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  profile_url: string;
  source: Platform;
  extracted_at: string;
  [key: string]: unknown;
}

export interface Extraction {
  id: string;
  kind: ExtractionKind;
  status: ExtractionStatus;
  source: Platform;
  type: ExtractionType | SearchType;
  url: string;
  /** Populated when `kind === "search"` — the original list of queries. */
  queries?: string[];
  provider: string;
  /**
   * Present only when a fallback was used. Holds the provider that was
   * initially selected by the router before the chain rolled over.
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

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  status: ProviderStatus;
  supported_platforms: Platform[];
  supported_types: ExtractionType[];
  /** Search-style services supported by this provider, if any. */
  supported_search_types?: SearchType[];
}

export interface ProviderDetail extends ProviderInfo {
  pricing: {
    type: ExtractionType;
    platforms: Platform[];
    price_per_record: number;
  }[];
  /** Pricing for search-style services, keyed by SearchType. */
  search_pricing?: {
    type: SearchType;
    platforms: Platform[];
    price_per_record: number;
  }[];
}

export interface AccountBalance {
  balance: number;
  currency: string;
}

export interface UsageSummary {
  period: string;
  total_requests: number;
  total_records: number;
  total_credits: number;
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
