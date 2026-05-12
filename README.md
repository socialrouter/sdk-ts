# SocialRouter SDK

A unified API to extract data from social media platforms. SocialRouter acts as an abstraction layer over multiple data providers (Apify, BrightData, etc.), offering a single interface, normalized data format, and automatic failover.

## Installation

```bash
npm install @socialrouter/sdk
```

## Quick Start

```typescript
import { SocialRouter } from "@socialrouter/sdk";

const client = new SocialRouter({
  apiKey: "sr_live_xxxxxxxxxxxxx",
});

const result = await client.extractAndWait({
  url: "https://www.linkedin.com/posts/johndoe_ai-sales-1234567890",
  provider: "apify/linkedin/post.likes",
  limit: 100,
});

for (const person of result.data) {
  console.log(`${person.name} - ${person.title} @ ${person.company}`);
}
```

## Provider slugs

The `provider` field is a slug of the form `<provider>/<platform>/<type>[:<tag>]` — for example `apify/linkedin/profile.info`, `apify/linkedin/profile.posts:apimaestro`, or `apify/googlemaps/place.search`. It fully specifies the routing target: which provider, which platform, which extraction or search type, and (optionally) which actor variant.

Browse the full catalogue (with pricing and copy buttons) at [socialrouter.io/providers](https://www.socialrouter.io/providers).

## Configuration

```typescript
const client = new SocialRouter({
  apiKey: "sr_live_xxxxxxxxxxxxx",              // Required
  baseUrl: "https://api.socialrouter.io",       // Optional (default value)
});
```

## Extracting Data (URL-driven)

### Extract and wait (recommended)

```typescript
const result = await client.extractAndWait({
  url: "https://www.linkedin.com/posts/johndoe_ai-sales-1234567890",
  provider: "apify/linkedin/post.likes",
  limit: 100,
});

console.log(result.status);            // "completed" or "failed"
console.log(result.data);              // ExtractionRecord[]
console.log(result.pagination.total);  // Total available records
```

You can customize the polling behavior:

```typescript
const result = await client.extractAndWait(
  { url: "...", provider: "apify/linkedin/post.likes" },
  5000,    // Poll every 5 seconds (default: 3000)
  60000,   // Timeout after 60 seconds (default: 120000)
);
```

### Batch URLs

When the target actor accepts batches, pass `urls` instead of `url`:

```typescript
const result = await client.extractAndWait({
  urls: [
    "https://linkedin.com/in/alice",
    "https://linkedin.com/in/bob",
    "https://linkedin.com/in/carol",
  ],
  provider: "apify/linkedin/profile.info",
  limit: 50,
});
```

### Disable fallback

By default, the router walks the provider chain when the requested one fails. Pass `fallback: false` to attempt only the requested provider and surface its error directly:

```typescript
await client.extract({
  url: "https://linkedin.com/in/johndoe",
  provider: "apify/linkedin/profile.info",
  fallback: false,
});
```

When a fallback was used, the response includes `fallback_from` (the initially-requested provider).

### Manual polling

```typescript
const extraction = await client.extract({
  url: "https://linkedin.com/posts/...",
  provider: "apify/linkedin/post.likes",
});

console.log(extraction.id); // "ext_abc123"

const result = await client.getExtraction(extraction.id);

if (result.status === "completed") {
  console.log(result.data);
} else if (result.status === "failed") {
  console.error(result.error);
}
```

## Searching (query-driven)

For services where the input is a query rather than a URL (e.g. Google Maps place search), use `search` / `searchAndWait`:

```typescript
const result = await client.searchAndWait({
  queries: ["coffee shops in Brooklyn", "bakeries in Brooklyn"],
  provider: "apify/googlemaps/place.search",
  limit: 100,
});

console.log(result.kind);     // "search"
console.log(result.queries);  // ["coffee shops in Brooklyn", ...]
console.log(result.data);     // ExtractionRecord[]
```

Search and extract share the same response shape; only `kind`, `queries`, and the supported `type` differ.

## Providers

```typescript
// List all available providers
const providers = await client.listProviders();

for (const p of providers) {
  console.log(`${p.name} [${p.status}] - ${p.supported_platforms.join(", ")}`);
  if (p.supported_search_types?.length) {
    console.log(`  search: ${p.supported_search_types.join(", ")}`);
  }
}

// Get provider details including pricing
const detail = await client.getProvider("apify");
console.log(detail.pricing);          // per-extraction pricing
console.log(detail.search_pricing);   // per-search pricing (if any)
```

## Account

```typescript
// Check credit balance
const balance = await client.getBalance();
console.log(`Balance: $${balance.balance} ${balance.currency}`);

// Get usage summary
const usage = await client.getUsage(30); // Last 30 days
console.log(`Requests: ${usage.total_requests}`);
console.log(`Records: ${usage.total_records}`);
console.log(`Credits used: $${usage.total_credits}`);
```

## Error Handling

```typescript
import {
  SocialRouter,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  SocialRouterError,
} from "@socialrouter/sdk";

try {
  await client.extractAndWait({ url: "...", provider: "apify/linkedin/post.likes" });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // 401 - Invalid or missing API key
  } else if (err instanceof InsufficientCreditsError) {
    // 402 - Not enough credits
  } else if (err instanceof RateLimitError) {
    // 429 - Too many requests
    console.log(`Retry after ${err.retryAfter} seconds`);
  } else if (err instanceof SocialRouterError) {
    // Other API error
    console.error(err.code, err.message, err.status);
  }
}
```

## TypeScript Types

All types are exported for direct use:

```typescript
import type {
  SocialRouterConfig,
  ExtractOptions,
  SearchOptions,
  Extraction,
  ExtractionRecord,
  ExtractionType,
  ExtractionStatus,
  ExtractionKind,
  SearchType,
  ServiceType,
  Platform,
  ProviderInfo,
  ProviderDetail,
  ProviderStatus,
  AccountBalance,
  UsageSummary,
  ApiErrorDetail,
} from "@socialrouter/sdk";
```

## License

MIT
