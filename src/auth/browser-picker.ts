import { createInterface } from "node:readline";

import type { BrowserId } from "@/config/types";

import type { AvailableBrowser } from "./browser-detect";

export interface BrowserPickerResult {
  ok: true;
  browser: BrowserId;
}

export interface BrowserPickerManual {
  ok: true;
  manual: true;
}

export interface BrowserPickerCancelled {
  ok: false;
  reason: "cancelled" | "no-browsers";
}

/** Check if any detected browsers are Chromium-based (will trigger keychain prompt) */
function hasChromiumBrowser(browsers: AvailableBrowser[]): boolean {
  return browsers.some((b) => ["chrome", "brave", "arc"].includes(b.id));
}

/**
 * Prompt user to select a browser from available options.
 * Runs in CLI before TUI launches.
 *
 * Returns the selected browser ID, manual entry flag, or cancellation.
 */
export async function promptBrowserSelection(
  browsers: AvailableBrowser[]
): Promise<BrowserPickerResult | BrowserPickerManual | BrowserPickerCancelled> {
  if (browsers.length === 0) {
    return { ok: false, reason: "no-browsers" };
  }

  // Auto-select if only one browser available (but still show keychain info)
  if (browsers.length === 1 && browsers[0]) {
    if (hasChromiumBrowser(browsers)) {
      console.log(
        "\nNote: macOS will ask for keychain access. Click 'Always Allow' to avoid future prompts.\n"
      );
    }
    console.log(`Using ${browsers[0].name} for X cookies.\n`);
    return { ok: true, browser: browsers[0].id };
  }

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C
    rl.on("close", () => {
      resolve({ ok: false, reason: "cancelled" });
    });

    // Show keychain info for Chromium browsers
    if (hasChromiumBrowser(browsers)) {
      console.log(
        "\nNote: Chromium browsers (Chrome/Brave/Arc) require keychain access."
      );
      console.log(
        "      macOS will prompt for your password. Click 'Always Allow' to save.\n"
      );
    }

    console.log("Select browser to read X cookies from:\n");

    for (let i = 0; i < browsers.length; i++) {
      const browser = browsers[i];
      if (browser) {
        console.log(`  [${i + 1}] ${browser.name}`);
      }
    }

    console.log(`  [M] Enter tokens manually (default)\n`);

    const askQuestion = (): void => {
      rl.question(`Choice (1-${browsers.length} or M) [M]: `, (answer) => {
        const trimmed = answer.trim().toLowerCase();

        // Empty input or 'm' - manual entry
        if (trimmed === "" || trimmed === "m") {
          resolve({ ok: true, manual: true });
          rl.close();
          return;
        }

        const choice = Number.parseInt(trimmed, 10);

        if (Number.isNaN(choice) || choice < 1 || choice > browsers.length) {
          console.log(
            `Please enter a number between 1 and ${browsers.length}, or M for manual`
          );
          askQuestion();
          return;
        }

        const selected = browsers[choice - 1];
        if (selected) {
          // Resolve BEFORE closing - close() synchronously triggers the 'close' event
          console.log(`\nUsing ${selected.name}.\n`);
          resolve({ ok: true, browser: selected.id });
          rl.close();
        } else {
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}
