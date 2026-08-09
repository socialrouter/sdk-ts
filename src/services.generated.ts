// ─── GENERATED FILE — DO NOT EDIT ────────────────────────
//
// Source of truth: @socialrouter/core (PLATFORM_SERVICES, ENTITY_SERVICES
// + input specs). Regenerate with `npm run gen:sdk` from packages/core.
//
// Only services served by at least one offer are listed: calling one
// that isn't would type-check here and 404 at the API.

/** Every callable extraction service, by platform. */
export const PLATFORM_SERVICES = {
  bluesky: [
    "post.info",
  ],
  facebook: [
    "event.info",
    "group.posts",
    "marketplace.listings",
    "page.reviews",
    "post.comments",
    "post.info",
    "profile.info",
    "profile.posts",
    "profile.reels",
  ],
  googlemaps: [
    "place.info",
    "place.reviews",
    "place.search",
  ],
  instagram: [
    "post.comments",
    "post.info",
    "profile.info",
    "reel.info",
  ],
  linkedin: [
    "company.info",
    "job.info",
    "post.info",
    "post.likes",
    "post.search",
    "profile.info",
    "profile.posts",
  ],
  pinterest: [
    "pin.info",
    "profile.info",
  ],
  reddit: [
    "post.comments",
    "post.info",
    "subreddit.posts",
  ],
  snapchat: [
    "post.info",
    "profile.info",
  ],
  tiktok: [
    "profile.info",
    "video.comments",
    "video.info",
  ],
  x: [
    "post.info",
    "profile.info",
  ],
  youtube: [
    "channel.info",
    "channel.shorts",
    "channel.videos",
    "hashtag.videos",
    "playlist.videos",
    "video.comments",
    "video.info",
    "video.search",
    "video.transcript",
  ],
} as const;

/** Every callable enrichment service, by entity. */
export const ENTITY_SERVICES = {
  company: [
    "info",
    "search",
  ],
  person: [
    "info",
    "search",
  ],
} as const;

export type Platform = keyof typeof PLATFORM_SERVICES;
export type Entity = keyof typeof ENTITY_SERVICES;

/** The left key of a service slug: a platform, or an enrichment entity. */
export type Subject = Platform | Entity;

export const PLATFORMS = Object.keys(PLATFORM_SERVICES) as Platform[];
export const ENTITIES = Object.keys(ENTITY_SERVICES) as Entity[];
export const SUBJECTS: Subject[] = [...PLATFORMS, ...ENTITIES];

/**
 * Service names valid on a given subject (or across all subjects).
 *
 * Conditional rather than one indexed access: the two vocabularies live
 * in separate consts, so `ServiceName<"linkedin">` resolves against
 * PLATFORM_SERVICES and `ServiceName<"person">` against ENTITY_SERVICES.
 */
export type ServiceName<S extends Subject = Subject> = S extends Platform
  ? (typeof PLATFORM_SERVICES)[S][number]
  : S extends Entity
    ? (typeof ENTITY_SERVICES)[S][number]
    : never;

/** A service, as passed to `run()`: "reddit/subreddit.posts", "person/info". */
export type ServiceSlug = {
  [S in Subject]: `${S}/${ServiceName<S>}`;
}[Subject];

/** The API namespace a service is called under. */
export type Namespace = "extract" | "enrich";

/**
 * The namespace of every callable service.
 *
 * The SDK builds request paths from this map rather than a hardcoded
 * prefix. It used to hardcode `/v1/extract/`, which made every
 * enrichment service silently uncallable.
 */
export const SERVICE_NAMESPACE = {
  "bluesky/post.info": "extract",
  "company/info": "enrich",
  "company/search": "enrich",
  "facebook/event.info": "extract",
  "facebook/group.posts": "extract",
  "facebook/marketplace.listings": "extract",
  "facebook/page.reviews": "extract",
  "facebook/post.comments": "extract",
  "facebook/post.info": "extract",
  "facebook/profile.info": "extract",
  "facebook/profile.posts": "extract",
  "facebook/profile.reels": "extract",
  "googlemaps/place.info": "extract",
  "googlemaps/place.reviews": "extract",
  "googlemaps/place.search": "extract",
  "instagram/post.comments": "extract",
  "instagram/post.info": "extract",
  "instagram/profile.info": "extract",
  "instagram/reel.info": "extract",
  "linkedin/company.info": "extract",
  "linkedin/job.info": "extract",
  "linkedin/post.info": "extract",
  "linkedin/post.likes": "extract",
  "linkedin/post.search": "extract",
  "linkedin/profile.info": "extract",
  "linkedin/profile.posts": "extract",
  "person/info": "enrich",
  "person/search": "enrich",
  "pinterest/pin.info": "extract",
  "pinterest/profile.info": "extract",
  "reddit/post.comments": "extract",
  "reddit/post.info": "extract",
  "reddit/subreddit.posts": "extract",
  "snapchat/post.info": "extract",
  "snapchat/profile.info": "extract",
  "tiktok/profile.info": "extract",
  "tiktok/video.comments": "extract",
  "tiktok/video.info": "extract",
  "x/post.info": "extract",
  "x/profile.info": "extract",
  "youtube/channel.info": "extract",
  "youtube/channel.shorts": "extract",
  "youtube/channel.videos": "extract",
  "youtube/hashtag.videos": "extract",
  "youtube/playlist.videos": "extract",
  "youtube/video.comments": "extract",
  "youtube/video.info": "extract",
  "youtube/video.search": "extract",
  "youtube/video.transcript": "extract",
} as const satisfies Record<ServiceSlug, Namespace>;

/**
 * What each service consumes: a URL per record, a free-text query, or an
 * identifier of the entity (an email, a domain, a profile URL, an id).
 */
export const SERVICE_INPUT_KIND = {
  "bluesky/post.info": "url",
  "company/info": "identifier",
  "company/search": "query",
  "facebook/event.info": "url",
  "facebook/group.posts": "url",
  "facebook/marketplace.listings": "url",
  "facebook/page.reviews": "url",
  "facebook/post.comments": "url",
  "facebook/post.info": "url",
  "facebook/profile.info": "url",
  "facebook/profile.posts": "url",
  "facebook/profile.reels": "url",
  "googlemaps/place.info": "url",
  "googlemaps/place.reviews": "url",
  "googlemaps/place.search": "query",
  "instagram/post.comments": "url",
  "instagram/post.info": "url",
  "instagram/profile.info": "url",
  "instagram/reel.info": "url",
  "linkedin/company.info": "url",
  "linkedin/job.info": "url",
  "linkedin/post.info": "url",
  "linkedin/post.likes": "url",
  "linkedin/post.search": "query",
  "linkedin/profile.info": "url",
  "linkedin/profile.posts": "url",
  "person/info": "identifier",
  "person/search": "query",
  "pinterest/pin.info": "url",
  "pinterest/profile.info": "url",
  "reddit/post.comments": "url",
  "reddit/post.info": "url",
  "reddit/subreddit.posts": "url",
  "snapchat/post.info": "url",
  "snapchat/profile.info": "url",
  "tiktok/profile.info": "url",
  "tiktok/video.comments": "url",
  "tiktok/video.info": "url",
  "x/post.info": "url",
  "x/profile.info": "url",
  "youtube/channel.info": "url",
  "youtube/channel.shorts": "url",
  "youtube/channel.videos": "url",
  "youtube/hashtag.videos": "url",
  "youtube/playlist.videos": "url",
  "youtube/video.comments": "url",
  "youtube/video.info": "url",
  "youtube/video.search": "query",
  "youtube/video.transcript": "url",
} as const satisfies Record<ServiceSlug, "url" | "query" | "identifier">;

export type InputKindOf<S extends ServiceSlug> = (typeof SERVICE_INPUT_KIND)[S];

/**
 * Method name per service, for the typed per-subject accessors:
 * `sr.reddit.subredditPosts(...)` runs "reddit/subreddit.posts", and
 * `sr.person.info(...)` runs "person/info".
 */
export const SERVICE_METHODS = {
  bluesky: {
    postInfo: "post.info",
  },
  company: {
    info: "info",
    search: "search",
  },
  facebook: {
    eventInfo: "event.info",
    groupPosts: "group.posts",
    marketplaceListings: "marketplace.listings",
    pageReviews: "page.reviews",
    postComments: "post.comments",
    postInfo: "post.info",
    profileInfo: "profile.info",
    profilePosts: "profile.posts",
    profileReels: "profile.reels",
  },
  googlemaps: {
    placeInfo: "place.info",
    placeReviews: "place.reviews",
    placeSearch: "place.search",
  },
  instagram: {
    postComments: "post.comments",
    postInfo: "post.info",
    profileInfo: "profile.info",
    reelInfo: "reel.info",
  },
  linkedin: {
    companyInfo: "company.info",
    jobInfo: "job.info",
    postInfo: "post.info",
    postLikes: "post.likes",
    postSearch: "post.search",
    profileInfo: "profile.info",
    profilePosts: "profile.posts",
  },
  person: {
    info: "info",
    search: "search",
  },
  pinterest: {
    pinInfo: "pin.info",
    profileInfo: "profile.info",
  },
  reddit: {
    postComments: "post.comments",
    postInfo: "post.info",
    subredditPosts: "subreddit.posts",
  },
  snapchat: {
    postInfo: "post.info",
    profileInfo: "profile.info",
  },
  tiktok: {
    profileInfo: "profile.info",
    videoComments: "video.comments",
    videoInfo: "video.info",
  },
  x: {
    postInfo: "post.info",
    profileInfo: "profile.info",
  },
  youtube: {
    channelInfo: "channel.info",
    channelShorts: "channel.shorts",
    channelVideos: "channel.videos",
    hashtagVideos: "hashtag.videos",
    playlistVideos: "playlist.videos",
    videoComments: "video.comments",
    videoInfo: "video.info",
    videoSearch: "video.search",
    videoTranscript: "video.transcript",
  },
} as const;

// ─── Typed options, per service ──────────────────────────

/** Options accepted by `company/search`. */
export interface CompanySearchOptions {
  /** What the query matches: the company's industry/keyword tags (default, e.g. "fintech"), or its name. */
  match?: "keywords" | "name";
  /** Comma-separated headquarters locations. */
  locations?: string;
  /** Comma-separated headquarters locations to exclude. */
  excludeLocations?: string;
  /** Headcount range, e.g. "51,200". Format: min,max. */
  employeeRange?: string;
  /** Comma-separated technologies the company uses, e.g. "salesforce, hubspot". */
  technologies?: string;
  /** Minimum annual revenue, in USD. */
  revenueMin?: number;
  /** Maximum annual revenue, in USD. */
  revenueMax?: number;
}

/** Options accepted by `linkedin/profile.info`. */
export interface LinkedinProfileInfoOptions {
  /** Include the public email lookup. Default: true. */
  includeEmail?: boolean;
}

/** Options accepted by `person/info`. */
export interface PersonInfoOptions {
  /** Also return personal email addresses. Consumes extra credits on your own provider account. Default: false. */
  revealPersonalEmails?: boolean;
}

/** Options accepted by `person/search`. */
export interface PersonSearchOptions {
  /** Comma-separated job titles. Similar titles are matched too, e.g. "head of growth, growth lead". */
  titles?: string;
  /** Comma-separated seniority levels: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern. */
  seniorities?: string;
  /** Comma-separated locations the person lives in, e.g. "Paris, London". */
  locations?: string;
  /** Comma-separated locations of the employer's headquarters. */
  companyLocations?: string;
  /** Comma-separated employer domains, e.g. "stripe.com, figma.com". */
  companyDomains?: string;
  /** Employer headcount range, e.g. "11,50". Format: min,max. */
  employeeRange?: string;
  /** Only people whose work email has this status. */
  emailStatus?: "verified" | "unverified" | "likely_to_engage" | "unavailable";
  /** Resolve each hit into a full profile, which is the only way to obtain a LinkedIn URL and an unmasked name. Consumes 1 credit per person matched on your own provider account. Set false for a credit-free preview: masked last names, no LinkedIn URL, is_obfuscated: true on every record. Default: true. */
  enrich?: boolean;
  /** Also return personal email addresses. Consumes extra credits on your own provider account. Default: false. */
  revealPersonalEmails?: boolean;
}

/** Options accepted by `reddit/subreddit.posts`. */
export interface RedditSubredditPostsOptions {
  /** Listing sort. Overrides a sort suffix present in the URL. */
  sort?: "hot" | "new" | "top" | "rising";
  /** Time window, applied when sort is "top". */
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  /** Only posts created on/after this UTC date. Format: YYYY-MM-DD. */
  postedAfter?: string;
  /** Only posts created before this UTC date. Format: YYYY-MM-DD. */
  postedBefore?: string;
}

/** Options accepted by `youtube/channel.shorts`. */
export interface YoutubeChannelShortsOptions {
  /** Order of the channel's videos (e.g. NEWEST, POPULAR, OLDEST). */
  sortVideosBy?: string;
}

/** Options accepted by `youtube/channel.videos`. */
export interface YoutubeChannelVideosOptions {
  /** Order of the channel's videos (e.g. NEWEST, POPULAR, OLDEST). */
  sortVideosBy?: string;
}

/** Options accepted by `youtube/hashtag.videos`. */
export interface YoutubeHashtagVideosOptions {
  /** Result ordering, as the YouTube UI names it (e.g. relevance, date, views). */
  sortingOrder?: string;
  /** Restrict to a video type (e.g. video, movie). */
  videoType?: string;
  /** Video length filter (e.g. under4, between420, over20). */
  lengthFilter?: string;
  /** Only HD videos. */
  isHD?: boolean;
  /** Only videos with subtitles. */
  hasSubtitles?: boolean;
  /** Only Creative Commons videos. */
  hasCC?: boolean;
  /** Only 3D videos. */
  is3D?: boolean;
  /** Only live streams. */
  isLive?: boolean;
  /** Only 4K videos. */
  is4K?: boolean;
  /** Only 360° videos. */
  is360?: boolean;
  /** Only geotagged videos. */
  hasLocation?: boolean;
  /** Only HDR videos. */
  isHDR?: boolean;
  /** Only VR180 videos. */
  isVR180?: boolean;
}

/** Options accepted by `youtube/video.info`. */
export interface YoutubeVideoInfoOptions {
  /** Also fetch the video's subtitles. Default: false. */
  downloadSubtitles?: boolean;
  /** Subtitle language code, e.g. "en". */
  subtitlesLanguage?: string;
  /** Prefer auto-generated subtitles over uploaded ones. */
  preferAutoGeneratedSubtitles?: boolean;
  /** Subtitle format (e.g. srt, vtt). */
  subtitlesFormat?: string;
}

/** Options accepted by `youtube/video.search`. */
export interface YoutubeVideoSearchOptions {
  /** Result ordering, as the YouTube UI names it (e.g. relevance, date, views). */
  sortingOrder?: string;
  /** Restrict to a video type (e.g. video, movie). */
  videoType?: string;
  /** Video length filter (e.g. under4, between420, over20). */
  lengthFilter?: string;
  /** Only HD videos. */
  isHD?: boolean;
  /** Only videos with subtitles. */
  hasSubtitles?: boolean;
  /** Only Creative Commons videos. */
  hasCC?: boolean;
  /** Only 3D videos. */
  is3D?: boolean;
  /** Only live streams. */
  isLive?: boolean;
  /** Only 4K videos. */
  is4K?: boolean;
  /** Only 360° videos. */
  is360?: boolean;
  /** Only geotagged videos. */
  hasLocation?: boolean;
  /** Only HDR videos. */
  isHDR?: boolean;
  /** Only VR180 videos. */
  isVR180?: boolean;
  /** Upload date filter (e.g. hour, today, week, month, year). */
  dateFilter?: string;
}

/**
 * Options type per service. Services that declare none map to an empty
 * object — passing any key is a compile error, matching the API, which
 * rejects unknown options with a corrective 400 rather than ignoring them.
 */
export interface ServiceOptionsMap {
  "bluesky/post.info": Record<string, never>;
  "company/info": Record<string, never>;
  "company/search": CompanySearchOptions;
  "facebook/event.info": Record<string, never>;
  "facebook/group.posts": Record<string, never>;
  "facebook/marketplace.listings": Record<string, never>;
  "facebook/page.reviews": Record<string, never>;
  "facebook/post.comments": Record<string, never>;
  "facebook/post.info": Record<string, never>;
  "facebook/profile.info": Record<string, never>;
  "facebook/profile.posts": Record<string, never>;
  "facebook/profile.reels": Record<string, never>;
  "googlemaps/place.info": Record<string, never>;
  "googlemaps/place.reviews": Record<string, never>;
  "googlemaps/place.search": Record<string, never>;
  "instagram/post.comments": Record<string, never>;
  "instagram/post.info": Record<string, never>;
  "instagram/profile.info": Record<string, never>;
  "instagram/reel.info": Record<string, never>;
  "linkedin/company.info": Record<string, never>;
  "linkedin/job.info": Record<string, never>;
  "linkedin/post.info": Record<string, never>;
  "linkedin/post.likes": Record<string, never>;
  "linkedin/post.search": Record<string, never>;
  "linkedin/profile.info": LinkedinProfileInfoOptions;
  "linkedin/profile.posts": Record<string, never>;
  "person/info": PersonInfoOptions;
  "person/search": PersonSearchOptions;
  "pinterest/pin.info": Record<string, never>;
  "pinterest/profile.info": Record<string, never>;
  "reddit/post.comments": Record<string, never>;
  "reddit/post.info": Record<string, never>;
  "reddit/subreddit.posts": RedditSubredditPostsOptions;
  "snapchat/post.info": Record<string, never>;
  "snapchat/profile.info": Record<string, never>;
  "tiktok/profile.info": Record<string, never>;
  "tiktok/video.comments": Record<string, never>;
  "tiktok/video.info": Record<string, never>;
  "x/post.info": Record<string, never>;
  "x/profile.info": Record<string, never>;
  "youtube/channel.info": Record<string, never>;
  "youtube/channel.shorts": YoutubeChannelShortsOptions;
  "youtube/channel.videos": YoutubeChannelVideosOptions;
  "youtube/hashtag.videos": YoutubeHashtagVideosOptions;
  "youtube/playlist.videos": Record<string, never>;
  "youtube/video.comments": Record<string, never>;
  "youtube/video.info": YoutubeVideoInfoOptions;
  "youtube/video.search": YoutubeVideoSearchOptions;
  "youtube/video.transcript": Record<string, never>;
}
