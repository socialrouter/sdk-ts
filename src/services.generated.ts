// ─── GENERATED FILE — DO NOT EDIT ────────────────────────
//
// Source of truth: @socialrouter/core (PLATFORM_SERVICES + input specs).
// Regenerate with `npm run gen:sdk` from packages/core.
//
// Only services served by at least one offer are listed: calling one
// that isn't would type-check here and 404 at the API.

/** Every callable service, by platform. */
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

export type Platform = keyof typeof PLATFORM_SERVICES;

export const PLATFORMS = Object.keys(PLATFORM_SERVICES) as Platform[];

/** Service names valid on a given platform (or across all platforms). */
export type ServiceName<P extends Platform = Platform> =
  (typeof PLATFORM_SERVICES)[P][number];

/** A service, as passed to `run()`: "reddit/subreddit.posts". */
export type ServiceSlug = {
  [P in Platform]: `${P}/${ServiceName<P>}`;
}[Platform];

/** What each service consumes: a URL per record, or a free-text query. */
export const SERVICE_INPUT_KIND = {
  "bluesky/post.info": "url",
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
  "linkedin/post.likes": "url",
  "linkedin/post.search": "query",
  "linkedin/profile.info": "url",
  "linkedin/profile.posts": "url",
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
} as const satisfies Record<ServiceSlug, "url" | "query">;

export type InputKindOf<S extends ServiceSlug> = (typeof SERVICE_INPUT_KIND)[S];

/**
 * Method name per service, for the typed per-platform accessors:
 * `sr.reddit.subredditPosts(...)` runs "reddit/subreddit.posts".
 */
export const SERVICE_METHODS = {
  bluesky: {
    postInfo: "post.info",
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
    postLikes: "post.likes",
    postSearch: "post.search",
    profileInfo: "profile.info",
    profilePosts: "profile.posts",
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

/** Options accepted by `linkedin/profile.info`. */
export interface LinkedinProfileInfoOptions {
  /** Include the public email lookup when the offer supports it. Default: true. */
  includeEmail?: boolean;
}

/** Options accepted by `reddit/subreddit.posts`. */
export interface RedditSubredditPostsOptions {
  /** Listing sort. Overrides a sort suffix present in the URL. */
  sort?: "hot" | "new" | "top" | "rising";
  /** Time window, applied when sort is "top". */
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  /** Only posts created on/after this UTC date (offer-dependent). Format: YYYY-MM-DD. */
  postedAfter?: string;
  /** Only posts created before this UTC date (offer-dependent). Format: YYYY-MM-DD. */
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
  /** Also fetch the video's subtitles (offer-dependent). Default: false. */
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
  "linkedin/post.likes": Record<string, never>;
  "linkedin/post.search": Record<string, never>;
  "linkedin/profile.info": LinkedinProfileInfoOptions;
  "linkedin/profile.posts": Record<string, never>;
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
