# SocialRouter SDK

A unified API to extract data from social media platforms. SocialRouter routes each call across several data sources (Apify, Bright Data…) behind one contract per service, with normalized records and automatic failover.

## Installation

```bash
npm install @socialrouter/sdk
```

## Quick Start

```typescript
import { SocialRouter } from "@socialrouter/sdk";

const sr = new SocialRouter({ apiKey: "sr_live_xxxxxxxxxxxxx" });

const result = await sr.run("linkedin/post.likes", {
  url: "https://www.linkedin.com/posts/johndoe_ai-sales-1234567890",
  limit: 100,
});

console.log(result.served_by); // "apify/apimaestro" — the offer that answered
for (const person of result.data) {
  console.log(`${person.name} — ${person.title} @ ${person.company}`);
}
```

The call is synchronous end to end: the returned run is already `completed` or `failed`.

## Services and offers

A **service** is `platform/service`, e.g. `reddit/subreddit.posts` — one endpoint, one contract, one output shape. An **offer** is one concrete implementation of that service by a source: `apify/harshmaur`, `brightdata/reddit`.

By default you don't pick an offer: the router runs the failover chain (cheapest first, skipping offers whose batch cap is too small) and tells you which one answered via `served_by`. Pin one with `provider` when you want that offer and nothing else — pinning disables failover.

```typescript
await sr.run("reddit/subreddit.posts", {
  url: "https://www.reddit.com/r/programming",
  provider: "apify/harshmaur", // optional — omit to let the router route
  options: { sort: "top", time: "week" },
});
```

Browse the catalogue at [socialrouter.io/services](https://www.socialrouter.io/services), or fetch it (see below).

## Typed per-service methods

Every callable service also has a typed method, grouped by platform:

```typescript
await sr.reddit.subredditPosts({ url: "https://www.reddit.com/r/programming" });
await sr.linkedin.profileInfo({ url: "https://linkedin.com/in/alice", options: { includeEmail: false } });
await sr.googlemaps.placeSearch({ queries: ["coffee shops in Brooklyn"] });
```

`run()` and the typed methods are the same call. Both are correlated with the service at compile time:

- a URL service takes `url` / `urls`, a query service takes `query` / `queries` — mixing them is a type error;
- `options` is the exact set that service declares (`sort: "hot" | "new" | "top" | "rising"` on `reddit/subreddit.posts`), and a service with no options rejects the field.

The service list is generated from the live registry, so it only contains services that are actually served.

## Configuration

```typescript
const sr = new SocialRouter({
  apiKey: "sr_live_xxxxxxxxxxxxx",          // Required
  baseUrl: "https://api.socialrouter.io",   // Optional (default)
});
```

## Batching

Pass `urls` (or `queries`) to send several inputs in one call. Each service's `max_inputs` per offer is in the catalogue; offers whose cap is smaller than your batch drop out of the failover chain instead of failing the call.

```typescript
const result = await sr.run("linkedin/profile.info", {
  urls: [
    "https://linkedin.com/in/alice",
    "https://linkedin.com/in/bob",
    "https://linkedin.com/in/carol",
  ],
  limit: 50,
});
```

## Catalogue

```typescript
// Every callable service, with offers in failover order
const services = await sr.listServices();
for (const s of services) {
  console.log(s.endpoint, s.offers.map((o) => `${o.offer} $${o.price_per_record}`).join(", "));
}

// One platform, or one service
await sr.listServices({ platform: "reddit" });
const svc = await sr.getService("reddit/subreddit.posts");
console.log(svc.accepts);  // accepted input shapes, with examples
console.log(svc.options);  // typed options

// The sources behind the offers
const sources = await sr.listSources();
```

## Fetching a past run

```typescript
const result = await sr.getExtraction("ext_abc123");
```

## Account

```typescript
const balance = await sr.getBalance();
console.log(`Balance: $${balance.balance} ${balance.currency}`);

const usage = await sr.getUsage(30); // last 30 days
console.log(usage.total_requests, usage.total_records, usage.total_credits);
console.log(usage.by_provider); // keyed by offer id, e.g. "apify/harshmaur"
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
  await sr.run("linkedin/post.likes", { url: "..." });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // 401 — invalid or missing API key
  } else if (err instanceof InsufficientCreditsError) {
    // 402 — not enough credits
  } else if (err instanceof RateLimitError) {
    // 429 — too many requests
    console.log(`Retry after ${err.retryAfter} seconds`);
  } else if (err instanceof SocialRouterError) {
    console.error(err.code, err.message, err.status);
  }
}
```

Validation errors (400/404) are written to be self-correcting: they name the field, the expected shape, and the valid alternatives — an unknown service lists the platform's services, an unknown offer lists the ones that serve it.

## TypeScript Types

```typescript
import type {
  SocialRouterConfig,
  RunInput,
  Extraction,
  ExtractionRecord,
  ExtractionStatus,
  Platform,
  ServiceName,
  ServiceSlug,
  ServiceOptionsMap,
  CatalogueService,
  CatalogueOffer,
  InputFormat,
  ServiceOption,
  SourceInfo,
  AccountBalance,
  UsageSummary,
  ApiErrorDetail,
} from "@socialrouter/sdk";
```

## Migrating from 0.3.x

The API moved to one endpoint per service; the SDK follows.

| 0.3.x | 0.4.0 |
|---|---|
| `extract({ url, provider: "apify/linkedin/profile.info" })` | `run("linkedin/profile.info", { url })` |
| `search({ queries, provider: "apify/googlemaps/place.search" })` | `run("googlemaps/place.search", { queries })` |
| `provider: "apify/reddit/group.posts:trudax"` | `run("reddit/subreddit.posts", { provider: "apify/trudax" })` |
| `fallback: false` | pin `provider` (pinning is what disables failover) |
| `extractAndWait` / `searchAndWait` | `run` — calls are synchronous |
| `listProviders()` / `getProvider(id)` | `listServices()` / `getService(slug)`; `listSources()` for the source view |
| `result.provider` | `result.served_by` |
| `result.source` / `result.type` | `result.platform` / `result.service` |
| `result.kind` | gone — the input kind is a property of the service |

Some services were renamed with the migration (`reddit/group.posts` → `reddit/subreddit.posts`, `youtube/profile.posts` → `youtube/channel.videos`, `tiktok/post.info` → `tiktok/video.info`…). `listServices()` returns the current names.

## License

MIT
