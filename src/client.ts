import type {
  AccountBalance,
  ApiErrorDetail,
  ByokMode,
  ByokModeSettings,
  CatalogueService,
  CredentialRevocation,
  Extraction,
  ProviderCredential,
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
  type Namespace,
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
   * The call is synchronous end-to-end: the returned extraction is
   * `completed`. A run that fails throws instead — a `SocialRouterError`
   * whose `extractionId` names the failed run.
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
    //
    // A miss means this SDK build predates the slug: the generated map is a
    // build-time snapshot, while callers (the MCP server, the CLI) validate
    // against the live catalogue. Fail here with the real cause instead of
    // interpolating `undefined` and letting the API answer with a 404 that
    // points at the route rather than at the stale dependency.
    const namespace = SERVICE_NAMESPACE[service];
    if (!namespace) {
      throw new Error(
        `run("${service}"): this SDK build does not know that service. Upgrade @socialrouter/sdk to a version whose catalogue includes it, or call listServices() to see what this build can run.`,
      );
    }

    return this.post<Extraction>(
      `/v1/${servicePath(service, namespace)}`,
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
    return this.get<CatalogueService>(`/v1/services/${service.split("/").map(encodeURIComponent).join("/")}`);
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

  /** Get usage summary over the last `days` days, 1..365. */
  async getUsage(days: number = 30): Promise<UsageSummary> {
    return this.get<UsageSummary>(`/v1/account/usage?days=${days}`);
  }

  // ─── Bring your own key ──────────────────────────────

  /**
   * Which provider account runs are placed on: the account default, the
   * sources that depart from it, and which sources accept a key at all.
   */
  async getByokMode(): Promise<ByokModeSettings> {
    return this.get<ByokModeSettings>("/v1/account/byok-mode");
  }

  /**
   * Set the account default — `setByokMode("own_first")` — or scope it to one
   * source: `setByokMode("own_only", { source: "apify" })`. Pass `null` with
   * a source to clear its override so it follows the default again.
   *
   * Answers with the settings as they now stand.
   */
  async setByokMode(mode: ByokMode, opts?: { source?: string }): Promise<ByokModeSettings>;
  async setByokMode(mode: null, opts: { source: string }): Promise<ByokModeSettings>;
  async setByokMode(mode: ByokMode | null, opts?: { source?: string }): Promise<ByokModeSettings> {
    const body: Record<string, unknown> = { byok_mode: mode };
    if (opts?.source !== undefined) body.source = opts.source;
    return this.request<ByokModeSettings>("PUT", "/v1/account/byok-mode", body);
  }

  /** The provider credentials registered on the account. Tokens are never returned. */
  async listCredentials(): Promise<ProviderCredential[]> {
    const res = await this.get<{ data: ProviderCredential[] }>("/v1/account/credentials");
    return res.data;
  }

  /**
   * Register or replace the provider token for one source, e.g.
   * `setCredential("apify", "apify_api_…")`. The API checks the token with
   * the provider first and stores nothing if it is refused.
   */
  async setCredential(
    source: string,
    token: string,
    opts?: { label?: string | null },
  ): Promise<ProviderCredential> {
    const body: Record<string, unknown> = { token };
    if (opts?.label !== undefined) body.label = opts.label;
    return this.request<ProviderCredential>(
      "PUT",
      `/v1/account/credentials/${encodeURIComponent(source)}`,
      body,
    );
  }

  /** Rename a source's credential. `null` clears the label. */
  async renameCredential(source: string, label: string | null): Promise<ProviderCredential> {
    return this.request<ProviderCredential>(
      "PATCH",
      `/v1/account/credentials/${encodeURIComponent(source)}`,
      { label },
    );
  }

  /** Revoke a source's credential. Runs on that source go back to credits, per the BYOK mode. */
  async removeCredential(source: string): Promise<CredentialRevocation> {
    return this.request<CredentialRevocation>(
      "DELETE",
      `/v1/account/credentials/${encodeURIComponent(source)}`,
    );
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
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        error?: ApiErrorDetail;
        extraction_id?: string;
      };
      const detail: ApiErrorDetail =
        json.error && typeof json.error === "object"
          ? json.error
          : { code: "unknown", message: res.statusText, type: "unknown" };
      // A failed run answers with its id beside the envelope — the caller's
      // only handle on it.
      const extractionId = typeof json.extraction_id === "string" ? json.extraction_id : undefined;

      switch (res.status) {
        case 401:
          throw new AuthenticationError(detail);
        case 402:
          throw new InsufficientCreditsError(detail, extractionId);
        case 429:
          throw new RateLimitError(detail, retryAfterSeconds(res.headers), extractionId);
        default:
          throw new SocialRouterError(detail, res.status, extractionId);
      }
    }

    return res.json() as Promise<T>;
  }
}

/**
 * The URL a service runs at.
 *
 * The slug ("linkedin/profile.info", "person/info") is the service's name
 * everywhere — in logs, in the CLI, in `served_by` — and each segment is
 * encoded. The namespace lives in the URL only, is derived from the subject
 * by the caller above, and is never part of the slug.
 *
 * `enrich` carries no service segment: an entity has exactly one service
 * today, so naming it in the URL would discriminate nothing. `extract`
 * still does — a platform can serve several. (Same rule as
 * `endpointOf` in @socialrouter/core.)
 */
function servicePath(service: string, namespace: Namespace): string {
  if (namespace === "enrich") return `enrich/${encodeURIComponent(subjectOf(service))}`;
  return `${namespace}/${service.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Seconds until a 429 clears.
 *
 * `Retry-After` is what the API sends, as delta-seconds, both for its own
 * request-volume limit and for an upstream provider limit. The `RateLimit`
 * header (`"default";r=0;t=42`) carries the same reset as `t`, and is read
 * only if `Retry-After` is missing. A credit ceiling on the key sends
 * neither: waiting does not clear it.
 */
function retryAfterSeconds(headers: Headers): number | undefined {
  const retryAfter = headers.get("Retry-After");
  if (retryAfter !== null && /^\d+$/.test(retryAfter.trim())) return Number(retryAfter);
  const reset = headers.get("RateLimit")?.match(/(?:^|;)\s*t=(\d+)/);
  return reset ? Number(reset[1]) : undefined;
}

function subjectOf(service: string): string {
  return service.split("/")[0];
}
