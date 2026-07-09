import type {
  SocialRouterConfig,
  SourceClient,
  ExtractOptions,
  SearchOptions,
  Extraction,
  ProviderInfo,
  ProviderDetail,
  AccountBalance,
  UsageSummary,
} from "./types.js";
import {
  SocialRouterError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://api.socialrouter.io";
const SDK_VERSION = "0.3.0";

export class SocialRouter {
  private apiKey: string;
  private baseUrl: string;
  private client: SourceClient;

  constructor(config: SocialRouterConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.client = config.client ?? "sdk";
  }

  // ─── Extract ─────────────────────────────────────────

  /**
   * Run a URL-driven data extraction. Pass either `url` (single) or `urls`
   * (batch — only meaningful when the target provider/actor accepts batches).
   */
  async extract(options: ExtractOptions): Promise<Extraction> {
    const body: Record<string, unknown> = {
      provider: options.provider,
    };
    if (options.urls !== undefined) {
      body.urls = options.urls;
    } else if (options.url !== undefined) {
      body.url = options.url;
    } else {
      throw new Error("extract() requires either 'url' or 'urls'.");
    }
    if (options.limit !== undefined) body.limit = options.limit;
    if (options.fallback !== undefined) body.fallback = options.fallback;
    if (options.options !== undefined) body.options = options.options;
    return this.post<Extraction>("/v1/extract", body);
  }

  /**
   * Run a query-driven search. The slug grammar matches `extract`, but the
   * `type` segment must belong to the SearchType union (e.g. `place.search`).
   */
  async search(options: SearchOptions): Promise<Extraction> {
    const body: Record<string, unknown> = {
      queries: options.queries,
      provider: options.provider,
    };
    if (options.limit !== undefined) body.limit = options.limit;
    if (options.fallback !== undefined) body.fallback = options.fallback;
    if (options.options !== undefined) body.options = options.options;
    return this.post<Extraction>("/v1/search", body);
  }

  /** Get extraction by ID (for polling async results) */
  async getExtraction(id: string): Promise<Extraction> {
    return this.get<Extraction>(`/v1/extract/${id}`);
  }

  /** Extract and poll until completed (convenience method) */
  async extractAndWait(
    options: ExtractOptions,
    pollIntervalMs: number = 3000,
    timeoutMs: number = 120000
  ): Promise<Extraction> {
    const extraction = await this.extract(options);

    if (extraction.status === "completed" || extraction.status === "failed") {
      return extraction;
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const result = await this.getExtraction(extraction.id);
      if (result.status !== "pending") return result;
    }

    throw new Error(`Extraction ${extraction.id} timed out after ${timeoutMs}ms`);
  }

  /** Run a search and poll until completed (convenience method) */
  async searchAndWait(
    options: SearchOptions,
    pollIntervalMs: number = 3000,
    timeoutMs: number = 120000
  ): Promise<Extraction> {
    const extraction = await this.search(options);

    if (extraction.status === "completed" || extraction.status === "failed") {
      return extraction;
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const result = await this.getExtraction(extraction.id);
      if (result.status !== "pending") return result;
    }

    throw new Error(`Search ${extraction.id} timed out after ${timeoutMs}ms`);
  }

  // ─── Providers ───────────────────────────────────────

  /** List all providers */
  async listProviders(): Promise<ProviderInfo[]> {
    const res = await this.get<{ data: ProviderInfo[] }>("/v1/providers");
    return res.data;
  }

  /** Get provider detail */
  async getProvider(id: string): Promise<ProviderDetail> {
    return this.get<ProviderDetail>(`/v1/providers/${id}`);
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
      const json = await res.json().catch(() => ({
        error: { code: "unknown", message: res.statusText, type: "unknown" },
      }));

      const detail = json.error ?? { code: "unknown", message: res.statusText, type: "unknown" };

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
