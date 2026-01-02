/**
 * Media handling utilities: Quick Look preview, download, and browser open
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join, extname } from "node:path";

import type { MediaItem } from "@/api/types";

/**
 * Default headers for fetching media from Twitter CDN
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
 */
async function openInBrowser(url: string): Promise<void> {
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
