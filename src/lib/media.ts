/**
 * Media handling utilities: Quick Look preview, download, and browser open
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join, extname } from "node:path";

import type { MediaItem, UrlEntity } from "@/api/types";

/**
 * Default headers for fetching media from X CDN
 * Helps avoid 403 errors from hotlinking protection
 */
const MEDIA_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://x.com/",
  Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
};

/**
 * Result type for media operations
 */
export type MediaResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Check if a URL is safe to fetch (not targeting internal/private resources)
 * Prevents SSRF attacks
 */
function isUrlSafeToFetch(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http/https schemes
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    ) {
      return false;
    }

    // Block private IP ranges (RFC 1918) and link-local
    const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
      hostname
    );
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.x.x.x (Class A private)
      if (a === 10) return false;
      // 172.16-31.x.x (Class B private)
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return false;
      // 192.168.x.x (Class C private)
      if (a === 192 && b === 168) return false;
      // 127.x.x.x (loopback)
      if (a === 127) return false;
      // 169.254.x.x (link-local, includes cloud metadata endpoint)
      if (a === 169 && b === 254) return false;
      // 0.x.x.x
      if (a === 0) return false;
    }

    // Block common internal hostnames
    const internalPatterns = [
      /^internal\./i,
      /^intranet\./i,
      /^private\./i,
      /\.internal$/i,
      /\.local$/i,
      /\.corp$/i,
    ];
    if (internalPatterns.some((pattern) => pattern.test(hostname))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL scheme is safe to open in browser
 */
function isUrlSafeToOpen(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https - block file://, javascript:, data:, etc.
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Get the best video URL (highest quality MP4)
 */
function getBestVideoUrl(media: MediaItem): string {
  if (media.videoVariants && media.videoVariants.length > 0) {
    // videoVariants are already sorted by bitrate descending in extractMedia
    return media.videoVariants[0]?.url ?? media.url;
  }
  return media.url;
}

/**
 * Get file extension from URL or media type
 */
function getExtension(media: MediaItem): string {
  if (media.type === "photo") {
    const urlExt = extname(media.url.split("?")[0] ?? "");
    return urlExt || ".jpg";
  }
  // Videos and GIFs are MP4
  return ".mp4";
}

/**
 * Open a URL in the default browser
 * Only allows http/https URLs for security (blocks file://, javascript:, etc.)
 */
export async function openInBrowser(url: string): Promise<void> {
  // Security: Validate URL scheme to prevent opening local files or executing scripts
  if (!isUrlSafeToOpen(url)) {
    throw new Error("URL scheme not allowed");
  }

  const os = platform();
  const cmd = os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open";

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [url], {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.unref();
    // Give it a moment to launch
    setTimeout(resolve, 100);
  });
}

/**
 * Preview media using Quick Look (macOS) or browser fallback
 *
 * - Photos on macOS: Download to temp, open with qlmanage -p
 * - Photos on Linux: Open URL with xdg-open (opens in browser)
 * - Videos/GIFs: Always open in browser
 */
export async function previewMedia(
  media: MediaItem,
  tweetId: string,
  index: number
): Promise<MediaResult> {
  const os = platform();

  // Videos and GIFs always open in browser
  if (media.type === "video" || media.type === "animated_gif") {
    const videoUrl = getBestVideoUrl(media);
    try {
      await openInBrowser(videoUrl);
      return { success: true, message: "Opened video in browser" };
    } catch {
      return { success: false, error: "Failed to open browser" };
    }
  }

  // Photos on macOS: Quick Look
  if (os === "darwin") {
    try {
      // Download to temp file
      const ext = getExtension(media);
      const tempPath = join(tmpdir(), `xfeed_${tweetId}_${index}${ext}`);

      const response = await fetch(media.url, { headers: MEDIA_FETCH_HEADERS });
      if (!response.ok) {
        return { success: false, error: `Download failed: ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      await writeFile(tempPath, Buffer.from(buffer));

      // Open with Quick Look
      return new Promise((resolve) => {
        const child = spawn("qlmanage", ["-p", tempPath], {
          stdio: "ignore",
        });

        child.on("close", () => {
          // Clean up temp file after Quick Look closes
          unlink(tempPath).catch(() => {});
          resolve({ success: true, message: "Closed Quick Look" });
        });

        child.on("error", () => {
          resolve({ success: false, error: "Failed to open Quick Look" });
        });
      });
    } catch {
      return { success: false, error: "Failed to preview image" };
    }
  }

  // Linux/other: Open URL in browser
  try {
    await openInBrowser(media.url);
    return { success: true, message: "Opened image in browser" };
  } catch {
    return { success: false, error: "Failed to open browser" };
  }
}

/**
 * Preview an image URL using Quick Look (macOS) or browser fallback
 * Used for profile photos and banners
 */
export async function previewImageUrl(
  url: string,
  name: string
): Promise<MediaResult> {
  const os = platform();

  // On macOS: Quick Look
  if (os === "darwin") {
    try {
      // Determine extension from URL
      const urlPath = url.split("?")[0] ?? "";
      const ext = extname(urlPath) || ".jpg";
      const tempPath = join(tmpdir(), `xfeed_${name}${ext}`);

      const response = await fetch(url, { headers: MEDIA_FETCH_HEADERS });
      if (!response.ok) {
        return { success: false, error: `Download failed: ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      await writeFile(tempPath, Buffer.from(buffer));

      // Open with Quick Look
      return new Promise((resolve) => {
        const child = spawn("qlmanage", ["-p", tempPath], {
          stdio: "ignore",
        });

        child.on("close", () => {
          unlink(tempPath).catch(() => {});
          resolve({ success: true, message: "Closed Quick Look" });
        });

        child.on("error", () => {
          resolve({ success: false, error: "Failed to open Quick Look" });
        });
      });
    } catch {
      return { success: false, error: "Failed to preview image" };
    }
  }

  // Linux/other: Open URL in browser
  try {
    await openInBrowser(url);
    return { success: true, message: "Opened image in browser" };
  } catch {
    return { success: false, error: "Failed to open browser" };
  }
}

/**
 * Download media to ~/Downloads/xfeed/
 *
 * Filename format: {tweet_id}_{index}.{ext}
 */
export async function downloadMedia(
  media: MediaItem,
  tweetId: string,
  index: number
): Promise<MediaResult> {
  const downloadDir = join(homedir(), "Downloads", "xfeed");
  const ext = getExtension(media);
  const filename = `${tweetId}_${index}${ext}`;
  const filepath = join(downloadDir, filename);

  try {
    // Ensure download directory exists
    await mkdir(downloadDir, { recursive: true });

    // Get the best URL (for videos, get highest quality)
    const url =
      media.type === "video" || media.type === "animated_gif"
        ? getBestVideoUrl(media)
        : media.url;

    // Download the file
    const response = await fetch(url, { headers: MEDIA_FETCH_HEADERS });
    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    await writeFile(filepath, Buffer.from(buffer));

    return { success: true, message: `Saved to ~/Downloads/xfeed/${filename}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Download failed: ${message}` };
  }
}

/**
 * Link metadata from HEAD/GET request
 */
export interface LinkMetadata {
  /** Page title if available */
  title?: string;
  /** Domain extracted from URL */
  domain: string;
  /** Content type from headers */
  contentType?: string;
  /** Whether the link is reachable */
  reachable: boolean;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Fetch metadata for a URL using HEAD request with GET fallback
 * Returns domain and title (if available from HTML)
 */
export async function fetchLinkMetadata(
  urlEntity: UrlEntity
): Promise<LinkMetadata> {
  const url = urlEntity.expandedUrl;
  const domain = extractDomain(url);

  // Security: Block requests to internal/private resources (SSRF prevention)
  if (!isUrlSafeToFetch(url)) {
    return { domain, reachable: false };
  }

  try {
    // Try HEAD first for quick metadata
    // Note: redirect: "manual" to prevent redirect-based SSRF bypass
    const headResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "manual",
    });

    // Handle redirects manually - check if redirect target is also safe
    if (headResponse.status >= 300 && headResponse.status < 400) {
      const location = headResponse.headers.get("location");
      if (location) {
        // Resolve relative URLs
        const redirectUrl = new URL(location, url).href;
        if (!isUrlSafeToFetch(redirectUrl)) {
          return { domain, reachable: false };
        }
        // Follow one redirect if safe
        const redirectResponse = await fetch(redirectUrl, {
          method: "HEAD",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,*/*",
          },
          redirect: "manual",
        });
        if (!redirectResponse.ok && redirectResponse.status < 300) {
          return { domain, reachable: false };
        }
      }
    }

    if (!headResponse.ok) {
      return { domain, reachable: false };
    }

    const contentType = headResponse.headers.get("content-type") ?? undefined;

    // If HTML, try to fetch title with a GET request
    if (contentType?.includes("text/html")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const getResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html",
            // Disable compression to avoid ZlibError with partial content
            "Accept-Encoding": "identity",
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (getResponse.ok) {
          // Only read first 16KB to find title quickly
          const reader = getResponse.body?.getReader();
          if (reader) {
            let html = "";
            let bytesRead = 0;
            const maxBytes = 16384;

            while (bytesRead < maxBytes) {
              const { done, value } = await reader.read();
              if (done) break;
              html += new TextDecoder().decode(value);
              bytesRead += value.length;

              // Check if we found the title already
              const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
              if (titleMatch?.[1]) {
                reader.cancel();
                const title = titleMatch[1]
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 100);
                return { domain, contentType, title, reachable: true };
              }
            }
            reader.cancel();
          }
        }
      } catch {
        // Ignore GET errors, still return HEAD success
      }
    }

    return { domain, contentType, reachable: true };
  } catch {
    return { domain, reachable: false };
  }
}
