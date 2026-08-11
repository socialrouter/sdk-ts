import type { ApiErrorDetail } from "./types.js";

export class SocialRouterError extends Error {
  public code: string;
  public type: string;
  public status: number;

  constructor(detail: ApiErrorDetail, status: number) {
    super(detail.message);
    this.name = "SocialRouterError";
    this.code = detail.code;
    this.type = detail.type;
    this.status = status;
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
  constructor(detail: ApiErrorDetail) {
    super(detail, 402);
    this.name = "InsufficientCreditsError";
  }
}

export class RateLimitError extends SocialRouterError {
  public retryAfter?: number;

  constructor(detail: ApiErrorDetail, retryAfter?: number) {
    super(detail, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
