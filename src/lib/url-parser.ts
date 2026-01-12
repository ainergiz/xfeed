/**
 * URL Parser - Parses x.com and twitter.com URLs to extract tweet or profile info
 */

export type ParsedUrl =
  | { type: "tweet"; username: string; tweetId: string }
  | { type: "profile"; username: string }
  | { type: "invalid"; error: string };

/** Reserved paths that are not user profiles */
const RESERVED_PATHS = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "settings",
  "i",
  "search",
  "compose",
  "intent",
  "hashtag",
  "lists",
]);

/**
 * Parse an X/Twitter URL to determine if it's a tweet or profile URL
 *
 * @param input - URL string (can be with or without protocol)
 * @returns ParsedUrl discriminated union
 */
export function parseXUrl(input: string): ParsedUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: "invalid", error: "URL cannot be empty" };
  }

  // Normalize the URL - add protocol if missing
  let url: URL;
  try {
    // Add https:// if no protocol is present
    const withProtocol = trimmed.match(/^https?:\/\//i)
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return { type: "invalid", error: "Invalid URL format" };
  }

  // Check if it's an X or Twitter domain
  const hostname = url.hostname.toLowerCase();
  if (
    hostname !== "x.com" &&
    hostname !== "twitter.com" &&
    hostname !== "www.x.com" &&
    hostname !== "www.twitter.com" &&
    hostname !== "mobile.x.com" &&
    hostname !== "mobile.twitter.com"
  ) {
    return { type: "invalid", error: "Not an X or Twitter URL" };
  }

  // Get path segments (filter out empty strings from leading/trailing slashes)
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return { type: "invalid", error: "No username or tweet ID in URL" };
  }

  const firstSegment = pathSegments[0];
  if (!firstSegment) {
    return { type: "invalid", error: "No username or tweet ID in URL" };
  }

  // Check if first segment is a reserved path
  if (RESERVED_PATHS.has(firstSegment.toLowerCase())) {
    return { type: "invalid", error: `"${firstSegment}" is not a profile` };
  }

  const username = firstSegment;

  // Check for tweet URL: /username/status/id
  if (pathSegments.length >= 3) {
    const secondSegment = pathSegments[1];
    const thirdSegment = pathSegments[2];

    if (secondSegment?.toLowerCase() === "status" && thirdSegment) {
      // Validate tweet ID is numeric
      if (!/^\d+$/.test(thirdSegment)) {
        return { type: "invalid", error: "Invalid tweet ID" };
      }
      return { type: "tweet", username, tweetId: thirdSegment };
    }
  }

  // Profile URL: /username (only one segment, or any other pattern)
  if (pathSegments.length === 1) {
    return { type: "profile", username };
  }

  // Handle other paths like /username/followers, /username/likes, etc.
  // These are treated as profile URLs
  if (pathSegments.length >= 2) {
    const secondSegment = pathSegments[1]?.toLowerCase();
    // Known profile sub-pages
    const profileSubPages = new Set([
      "followers",
      "following",
      "likes",
      "with_replies",
      "media",
      "highlights",
      "articles",
      "verified_followers",
      "photo",
      "header_photo",
    ]);
    if (secondSegment && profileSubPages.has(secondSegment)) {
      return { type: "profile", username };
    }
  }

  // For other unrecognized paths under a username, still treat as profile
  return { type: "profile", username };
}
