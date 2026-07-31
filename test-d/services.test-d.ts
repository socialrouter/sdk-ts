import { SocialRouter } from "../src/client.js";

const sr = new SocialRouter({ apiKey: "k" });

// OK
await sr.run("reddit/subreddit.posts", {
  url: "https://reddit.com/r/x",
  options: { sort: "top", time: "week" },
});
await sr.run("googlemaps/place.search", { queries: ["pizza"] });
await sr.reddit.subredditPosts({ urls: ["u"], provider: "apify/harshmaur" });
await sr.linkedin.profileInfo({ url: "u", options: { includeEmail: false } });
await sr.getService("youtube/video.search");

// @ts-expect-error unknown service
await sr.run("reddit/nope", { url: "u" });
// @ts-expect-error url service does not take queries
await sr.run("reddit/subreddit.posts", { queries: ["a"] });
// @ts-expect-error query service does not take urls
await sr.run("googlemaps/place.search", { urls: ["a"] });
// @ts-expect-error bad enum value
await sr.run("reddit/subreddit.posts", { url: "u", options: { sort: "best" } });
// @ts-expect-error service declares no options
await sr.run("reddit/post.info", { url: "u", options: { sort: "top" } });
// @ts-expect-error offer id must be source/name
await sr.run("reddit/post.info", { url: "u", provider: "harshmaur" });
// @ts-expect-error unknown method on the platform namespace
await sr.reddit.groupPosts({ url: "u" });
