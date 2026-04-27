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

export class AuthenticationError extends SocialRouterError {
  constructor(detail: ApiErrorDetail) {
    super(detail, 401);
    this.name = "AuthenticationError";
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
