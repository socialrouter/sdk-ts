export type ExtractionType =
  | "post.likes"
  | "post.comments"
  | "profile.info"
  | "profile.posts"
  | "profile.followers";

export type Platform = "linkedin" | "instagram" | "x" | "reddit";
export type ExtractionStatus = "pending" | "completed" | "failed";

export interface ExtractOptions {
  url: string;
  /**
   * Service slug of the form `<provider>/<platform>/<type>`
   * (e.g. `apify/linkedin/profile.info`). Copy-paste-friendly from the
   * providers page; fully specifies the routing target.
   */
  provider: string;
  limit?: number;
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
  status: ExtractionStatus;
  source: Platform;
  type: ExtractionType;
  url: string;
  provider: string;
  credits_used: number;
  data: ExtractionRecord[];
  pagination: {
    total: number;
    returned: number;
    next_cursor: string | null;
  };
  error?: ApiErrorDetail;
  created_at: string;
  completed_at: string | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  supported_platforms: Platform[];
  supported_types: ExtractionType[];
}

export interface ProviderDetail extends ProviderInfo {
  pricing: {
    type: ExtractionType;
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

export interface SocialRouterConfig {
  apiKey: string;
  baseUrl?: string;
}
