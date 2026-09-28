import type { ApiErrorDetail } from "./types.js";

export class SocialRouterError extends Error {
  public code: string;
  public type: string;
  public status: number;
  /**
   * The whole `error` envelope, including the corrective fields a validation
   * error carries (`valid_options`, `invalid_inputs`, `did_you_mean`…) and
   * `provider_detail` on a run placed on your own provider key.
   */
  public detail: ApiErrorDetail;
  /**
   * The id of the run that failed, when the failure came from a run. It is
   * the only handle on a failed run: pass it to `getExtraction()`, or quote
   * it in a bug report.
   */
  public extractionId?: string;

  constructor(detail: ApiErrorDetail, status: number, extractionId?: string) {
    super(detail.message);
    this.name = "SocialRouterError";
    this.code = detail.code;
    this.type = detail.type;
    this.status = status;
    this.detail = detail;
    this.extractionId = extractionId;
  }
}

/** Where a key is created, rotated or revoked — the only fix for a 401. */
export const DASHBOARD_KEYS_URL = "https://www.socialrouter.io/dashboard/keys";

export class AuthenticationError extends SocialRouterError {
  /**
   * The actionable half of the message, kept separate so a caller rendering
   * its own UI can show it apart from the API's wording.
   */
  public hint: string;

  /**
   * A 401 is the one failure no retry and no code change gets past: the key is
   * missing, revoked or wrong, and only a human with the dashboard open can
   * fix it. The API's message says what happened, so the error appends where
   * to go — otherwise the caller reads "invalid or has been revoked" and has
   * to go looking for the page themselves.
   */
  constructor(detail: ApiErrorDetail) {
    super(detail, 401);
    this.name = "AuthenticationError";
    this.hint = `Create a new API key at ${DASHBOARD_KEYS_URL} and use it as your SocialRouter API key.`;
    this.message = `${detail.message} ${this.hint}`;
  }
}

export class InsufficientCreditsError extends SocialRouterError {
  constructor(detail: ApiErrorDetail, extractionId?: string) {
    super(detail, 402, extractionId);
    this.name = "InsufficientCreditsError";
  }
}

export class RateLimitError extends SocialRouterError {
  /**
   * Seconds to wait before retrying, from the `Retry-After` header. Absent
   * when the limit is not one that clears by waiting — `credit_limit_exceeded`
   * is a ceiling set on the API key, and no retry gets past it.
   */
  public retryAfter?: number;

  constructor(detail: ApiErrorDetail, retryAfter?: number, extractionId?: string) {
    super(detail, 429, extractionId);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
