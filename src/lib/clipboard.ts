/**
 * Clipboard utilities for copying text to system clipboard
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";

export type ClipboardResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Copy text to system clipboard
 * Uses platform-specific commands: pbcopy (macOS), xclip (Linux), clip (Windows)
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  const os = platform();

  let command: string;
  let args: string[];

  switch (os) {
    case "darwin":
      command = "pbcopy";
      args = [];
      break;
    case "linux":
      command = "xclip";
      args = ["-selection", "clipboard"];
      break;
    case "win32":
      command = "clip";
      args = [];
      break;
    default:
      return { success: false, error: `Unsupported platform: ${os}` };
  }

  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });

    proc.on("error", (err) => {
      resolve({ success: false, error: `Failed to copy: ${err.message}` });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, message: "Copied to clipboard" });
      } else {
        resolve({ success: false, error: `Copy failed with code ${code}` });
      }
    });

    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}
