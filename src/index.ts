export { SocialRouter } from "./client.js";
export type { PlatformClient, TypedServices } from "./client.js";
export {
  SocialRouterError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
} from "./errors.js";
export {
  PLATFORMS,
  PLATFORM_SERVICES,
  SERVICE_INPUT_KIND,
  SERVICE_METHODS,
} from "./services.generated.js";
export type {
  SocialRouterConfig,
  SourceClient,
  RunInput,
  RunCommon,
  UrlInput,
  QueryInput,
  OfferId,
  Extraction,
  ExtractionRecord,
  ExtractionStatus,
  InputKind,
  Platform,
  ServiceName,
  ServiceSlug,
  ServiceOptionsMap,
  CatalogueService,
  CatalogueOffer,
  InputFormat,
  ServiceOption,
  SourceInfo,
  SourceStatus,
  AccountBalance,
  UsageSummary,
  ApiErrorDetail,
} from "./types.js";
