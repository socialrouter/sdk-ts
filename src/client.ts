import type {
  AccountBalance,
  ApiErrorDetail,
  CatalogueService,
  Extraction,
  RunInput,
  SocialRouterConfig,
  SourceClient,
  SourceInfo,
  UsageSummary,
} from "./types.js";
import {
  PLATFORMS,
  SERVICE_METHODS,
  type Platform,
  type ServiceSlug,
} from "./services.generated.js";
import {
  SocialRouterError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://api.socialrouter.io";
const SDK_VERSION = "0.4.0";

type MethodMap = typeof SERVICE_METHODS;

type SlugOf<P extends Platform, M extends keyof MethodMap[P]> =
  `${P}/${Extract<MethodMap[P][M], string>}`;

/** The typed methods of one platform: `sr.reddit.subredditPosts(...)`. */
export type PlatformClient<P extends Platform> = {
  [M in keyof MethodMap[P]]: (
    input: SlugOf<P, M> extends ServiceSlug ? RunInput<SlugOf<P, M>> : never,
  ) => Promise<Extraction>;
};

/** One namespace per platform, hung off the client. */
export type TypedServices = { [P in Platform]: PlatformClient<P> };

// Declaration merging: the per-platform namespaces are built at runtime from
// the generated method map, so they are declared here rather than as class
// fields — adding a platform in core needs no edit to this file.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocialRouter extends TypedServices {}

export class SocialRouter {
  private apiKey: string;
  private baseUrl: string;
  private client: SourceClient;

  constructor(config: SocialRouterConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.client = config.client ?? "sdk";

    // The API key travels in the Authorization header on every request — warn
    // loudly if the base URL is plaintext HTTP, which would send it in clear.
    if (this.baseUrl.startsWith("http://")) {
      console.warn(
        "[socialrouter] baseUrl uses http:// — your API key will be sent unencrypted. Use https:// unless this is a local dev server.",
      );
    }

    for (const platform of PLATFORMS) {
      const methods: Record<string, unknown> = {};
      for (const [method, service] of Object.entries(SERVICE_METHODS[platform])) {
        methods[method] = (input: Record<string, unknown>) =>
          this.run(`${platform}/${service}` as ServiceSlug, input as never);
      }
      (this as unknown as Record<string, unknown>)[platform] = methods;
    }
  }

  // ─── Run ─────────────────────────────────────────────

  /**
   * Run a service: `run("reddit/subreddit.posts", { url: "..." })`.
   *
   * One endpoint per service — the input field follows the service's kind
   * (`url`/`urls` for URL services, `query`/`queries` for query ones) and
   * `options` is the set that service declares; both are enforced at compile
   * time. Omit `provider` to let the router pick and fail over; pin an offer
   * id to run that offer alone.
   *
   * The call is synchronous end-to-end: the returned extraction is already
   * `completed` or `failed`.
   */
  async run<S extends ServiceSlug>(service: S, input: RunInput<S>): Promise<Extraction> {
    const src = input as {
      url?: string;
      urls?: string[];
      query?: string;
      queries?: string[];
      provider?: string;
      limit?: number;
      options?: Record<string, unknown>;
    };

    const body: Record<string, unknown> = {};
    if (src.urls !== undefined) body.urls = src.urls;
    else if (src.url !== undefined) body.url = src.url;
    else if (src.queries !== undefined) body.queries = src.queries;
    else if (src.query !== undefined) body.query = src.query;
    else {
      throw new Error(
        `run("${service}") requires an input: 'url'/'urls' for a URL service, 'query'/'queries' for a query one. See listServices() for which one this service takes.`,
      );
    }
    if (src.provider !== undefined) body.provider = src.provider;
    if (src.limit !== undefined) body.limit = src.limit;
    if (src.options !== undefined) body.options = src.options;

    return this.post<Extraction>(`/v1/extract/${servicePath(service)}`, body);
  }

  /** Get a past run by ID. */
  async getExtraction(id: string): Promise<Extraction> {
    // Encode the id — it's interpolated into the path, so a caller-supplied
    // value containing "/" or "?" must not alter the request target.
    return this.get<Extraction>(`/v1/extractions/${encodeURIComponent(id)}`);
  }

  // ─── Catalogue ───────────────────────────────────────

  /**
   * The service catalogue: one entry per callable (platform, service) with
   * its offers in failover order, prices, caps, accepted input shapes and
   * typed options. Public — no credits, no auth needed.
   */
  async listServices(filter?: { platform?: Platform }): Promise<CatalogueService[]> {
    const path = filter?.platform
      ? `/v1/services/${encodeURIComponent(filter.platform)}`
      : "/v1/services";
    const res = await this.get<{ data: CatalogueService[] }>(path);
    return res.data;
  }

  /** One catalogue entry: `getService("reddit/subreddit.posts")`. */
  async getService(service: ServiceSlug): Promise<CatalogueService> {
    return this.get<CatalogueService>(`/v1/services/${servicePath(service)}`);
  }

  /** The data sources behind the offers (Apify, Bright Data…). */
  async listSources(): Promise<SourceInfo[]> {
    const res = await this.get<{ data: SourceInfo[] }>("/v1/providers");
    return res.data;
  }

  /** One source by id, e.g. `"apify"`. */
  async getSource(id: string): Promise<SourceInfo> {
    return this.get<SourceInfo>(`/v1/providers/${encodeURIComponent(id)}`);
  }

  // ─── Account ─────────────────────────────────────────

  /** Get credit balance */
  async getBalance(): Promise<AccountBalance> {
    return this.get<AccountBalance>("/v1/account/balance");
  }

  /** Get usage summary */
  async getUsage(days: number = 30): Promise<UsageSummary> {
    return this.get<UsageSummary>(`/v1/account/usage?days=${days}`);
  }

  // ─── HTTP ────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `socialrouter-sdk/${SDK_VERSION}`,
        "X-SocialRouter-Client": this.client,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: ApiErrorDetail };
      const detail: ApiErrorDetail = json.error ?? {
        code: "unknown",
        message: res.statusText,
        type: "unknown",
      };

      switch (res.status) {
        case 401:
          throw new AuthenticationError(detail);
        case 402:
          throw new InsufficientCreditsError(detail);
        case 429: {
          const retryAfter = res.headers.get("X-RateLimit-Reset");
          throw new RateLimitError(detail, retryAfter ? Number(retryAfter) : undefined);
        }
        default:
          throw new SocialRouterError(detail, res.status);
      }
    }

    return res.json() as Promise<T>;
  }
}

/** "reddit/subreddit.posts" → "reddit/subreddit.posts", each segment encoded. */
/**
 * Turn a service slug into the path segments under `/v1/extract`.
 *
 * The slug ("linkedin/profile.info") is the service's name everywhere — in
 * logs, in the CLI, in `served_by`. The `extract` namespace lives in the URL
 * only, and is added by the caller above; it is never part of the slug.
 */
function servicePath(service: string): string {
  return service.split("/").map(encodeURIComponent).join("/");
}
