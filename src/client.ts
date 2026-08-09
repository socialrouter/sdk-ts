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
  SERVICE_METHODS,
  SERVICE_NAMESPACE,
  SUBJECTS,
  type ServiceSlug,
  type Subject,
} from "./services.generated.js";
import {
  SocialRouterError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
} from "./errors.js";
import { readFileSync } from "node:fs";

const DEFAULT_BASE_URL = "https://api.socialrouter.io";
/**
 * Read from package.json rather than hardcoded, so `npm version` is the only
 * place a release touches. Resolves to the package root from dist/index.js,
 * and npm always ships package.json in the tarball.
 */
const SDK_VERSION = (
  JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

type MethodMap = typeof SERVICE_METHODS;

type SlugOf<S extends Subject, M extends keyof MethodMap[S]> =
  `${S}/${Extract<MethodMap[S][M], string>}`;

/**
 * The typed methods of one subject: `sr.reddit.subredditPosts(...)` on a
 * platform, `sr.person.info(...)` on an enrichment entity.
 */
export type PlatformClient<S extends Subject> = {
  [M in keyof MethodMap[S]]: (
    input: SlugOf<S, M> extends ServiceSlug ? RunInput<SlugOf<S, M>> : never,
  ) => Promise<Extraction>;
};

/** One accessor per subject, hung off the client. */
export type TypedServices = { [S in Subject]: PlatformClient<S> };

// Declaration merging: the per-subject accessors are built at runtime from
// the generated method map, so they are declared here rather than as class
// fields — adding a subject in core needs no edit to this file.
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

    for (const subject of SUBJECTS) {
      const methods: Record<string, unknown> = {};
      for (const [method, service] of Object.entries(SERVICE_METHODS[subject])) {
        methods[method] = (input: Record<string, unknown>) =>
          this.run(`${subject}/${service}` as ServiceSlug, input as never);
      }
      (this as unknown as Record<string, unknown>)[subject] = methods;
    }
  }

  // ─── Run ─────────────────────────────────────────────

  /**
   * Run a service: `run("reddit/subreddit.posts", { url: "..." })`, or
   * `run("person/info", { identifiers: ["ada@example.com"] })`.
   *
   * One endpoint per service — the input field follows the service's kind
   * (`url`/`urls`, `query`/`queries`, `identifier`/`identifiers`) and
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
      identifier?: string;
      identifiers?: string[];
      provider?: string;
      limit?: number;
      options?: Record<string, unknown>;
    };

    const body: Record<string, unknown> = {};
    if (src.urls !== undefined) body.urls = src.urls;
    else if (src.url !== undefined) body.url = src.url;
    else if (src.queries !== undefined) body.queries = src.queries;
    else if (src.query !== undefined) body.query = src.query;
    else if (src.identifiers !== undefined) body.identifiers = src.identifiers;
    else if (src.identifier !== undefined) body.identifier = src.identifier;
    else {
      throw new Error(
        `run("${service}") requires an input: 'url'/'urls' for a URL service, 'query'/'queries' for a query one, 'identifier'/'identifiers' for an enrichment one. See listServices() for which one this service takes.`,
      );
    }
    if (src.provider !== undefined) body.provider = src.provider;
    if (src.limit !== undefined) body.limit = src.limit;
    if (src.options !== undefined) body.options = src.options;

    // The namespace comes from the generated map, never from a literal. This
    // path was hardcoded to `/v1/extract/`, which made every enrichment
    // service 404 — with a body the API had already validated as fine.
    return this.post<Extraction>(
      `/v1/${SERVICE_NAMESPACE[service]}/${servicePath(service)}`,
      body,
    );
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
  async listServices(filter?: { platform?: Subject }): Promise<CatalogueService[]> {
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

/**
 * Turn a service slug into path segments, each encoded.
 *
 * The slug ("linkedin/profile.info", "person/info") is the service's name
 * everywhere — in logs, in the CLI, in `served_by`. The namespace lives in
 * the URL only, is derived from the subject by the caller above, and is
 * never part of the slug.
 */
function servicePath(service: string): string {
  return service.split("/").map(encodeURIComponent).join("/");
}
