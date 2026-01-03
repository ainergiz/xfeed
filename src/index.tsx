#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { cac } from "cac";

import type { BrowserId } from "@/config/types";

/**
 * Check if running in Apple Terminal which has limited color support
 * Blocks execution since the UI is unusable without true color
 */
function checkTerminalCompatibility(): void {
  const termProgram = process.env.TERM_PROGRAM;
  const colorterm = process.env.COLORTERM;

  // Apple Terminal doesn't set COLORTERM and has limited true color support
  if (termProgram === "Apple_Terminal" && colorterm !== "truecolor") {
    console.error(
      "\x1b[31m✗ Apple Terminal is not supported.\x1b[0m\n\n" +
        "  xfeed requires a terminal with true color (24-bit) support.\n" +
        "  Apple Terminal only supports 256 colors, causing display issues.\n\n" +
        "  \x1b[1mRecommended terminals:\x1b[0m\n" +
        "    • Ghostty  - https://ghostty.org\n" +
        "    • iTerm2   - https://iterm2.com\n" +
        "    • Kitty    - https://sw.kovidgoyal.net/kitty\n" +
        "    • Warp     - https://warp.dev\n"
    );
    process.exit(1);
  }
}

import { App } from "@/app";
import { detectAvailableBrowsers, isInteractive } from "@/auth/browser-detect";
import { promptBrowserSelection } from "@/auth/browser-picker";
import { checkAuth, formatWarnings } from "@/auth/check";
import { promptManualTokenEntry } from "@/auth/manual-entry";
import {
  clearBrowserPreference,
  getConfigPath,
  loadConfig,
  updateConfig,
} from "@/config/loader";
import { ModalProvider } from "@/contexts/ModalContext";

const cli = cac("xfeed");

const VALID_BROWSERS: BrowserId[] = [
  "safari",
  "chrome",
  "brave",
  "arc",
  "firefox",
];

cli
  .command("", "Launch xfeed TUI")
  .option("--auth-token <token>", "X auth_token cookie")
  .option("--ct0 <token>", "X ct0 cookie (CSRF token)")
  .option(
    "--browser <browser>",
    "Browser to read cookies from (safari, chrome, brave, arc, firefox)"
  )
  .option("--chrome-profile <profile>", "Chrome/Brave/Arc profile name")
  .option("--firefox-profile <profile>", "Firefox profile name")
  .option("--skip-validation", "Skip API validation of credentials")
  .option("--reset-auth", "Clear saved browser preference and re-prompt")
  .action(
    async (options: {
      authToken?: string;
      ct0?: string;
      browser?: string;
      chromeProfile?: string;
      firefoxProfile?: string;
      skipValidation?: boolean;
      resetAuth?: boolean;
    }) => {
      // Check terminal compatibility first
      checkTerminalCompatibility();

      // Handle --reset-auth
      if (options.resetAuth) {
        clearBrowserPreference();
        console.log(`Cleared saved auth from ${getConfigPath()}\n`);
      }

      // Validate browser option if provided via CLI
      if (
        options.browser &&
        !VALID_BROWSERS.includes(options.browser as BrowserId)
      ) {
        console.error(
          `Invalid browser: ${options.browser}. Must be one of: ${VALID_BROWSERS.join(", ")}`
        );
        process.exit(1);
      }

      // Load saved config
      const config = loadConfig();

      // Determine browser source: CLI > config > prompt
      let browserSource: BrowserId | undefined = options.browser as
        | BrowserId
        | undefined;
      let manualTokens: { authToken: string; ct0: string } | undefined;

      // Check for saved tokens first (unless --reset-auth)
      if (
        !options.authToken &&
        config.authToken &&
        config.ct0 &&
        !options.resetAuth
      ) {
        manualTokens = { authToken: config.authToken, ct0: config.ct0 };
      }

      if (!browserSource && !options.authToken && !manualTokens) {
        // Check saved browser preference
        if (config.browser && !options.resetAuth) {
          browserSource = config.browser;
        } else {
          // Detect available browsers
          const availableBrowsers = detectAvailableBrowsers();

          if (availableBrowsers.length === 0 && !isInteractive()) {
            console.error(
              "No supported browsers detected with cookie databases.\n" +
                "Please log into x.com in Safari, Chrome, Brave, Arc, or Firefox."
            );
            process.exit(1);
          }

          if (isInteractive()) {
            // Prompt user to select browser (or manual entry)
            const pickerResult =
              await promptBrowserSelection(availableBrowsers);

            if (!pickerResult.ok) {
              if (pickerResult.reason === "cancelled") {
                console.log("\nCancelled.");
                process.exit(0);
              }
              console.error("No browsers available.");
              process.exit(1);
            }

            // Check if user chose manual entry
            if ("manual" in pickerResult && pickerResult.manual) {
              const manualResult = await promptManualTokenEntry();

              if (!manualResult.ok) {
                process.exit(0);
              }

              manualTokens = manualResult.tokens;

              // Save tokens for next time
              updateConfig({
                authToken: manualTokens.authToken,
                ct0: manualTokens.ct0,
                // Clear browser preference since we're using tokens
                browser: undefined,
              });
            } else if ("browser" in pickerResult) {
              browserSource = pickerResult.browser;

              // Save browser preference (and clear any saved tokens)
              updateConfig({
                browser: browserSource,
                chromeProfile: options.chromeProfile,
                firefoxProfile: options.firefoxProfile,
                authToken: undefined,
                ct0: undefined,
              });
            }
          } else {
            // Not interactive - auto-select first available browser
            browserSource = availableBrowsers[0]?.id;
            if (browserSource) {
              console.log(
                `Auto-selecting ${availableBrowsers[0]?.name} (non-interactive mode).`
              );
            }
          }
        }
      }

      // Check authentication
      let authResult = await checkAuth({
        authToken: manualTokens?.authToken ?? options.authToken,
        ct0: manualTokens?.ct0 ?? options.ct0,
        cookieSource: browserSource,
        chromeProfile: options.chromeProfile ?? config.chromeProfile,
        firefoxProfile: options.firefoxProfile ?? config.firefoxProfile,
        skipValidation: options.skipValidation,
      });

      // Show warnings if any (but not in error case - they're included in the error)
      if (authResult.ok && authResult.warnings.length > 0) {
        console.warn("Warnings:\n" + formatWarnings(authResult.warnings));
      }

      // If auth failed and we're interactive, show full auth options
      if (!authResult.ok && isInteractive()) {
        console.error(authResult.error);
        console.log("\nLet's re-authenticate.\n");

        // Clear any saved auth that might be stale
        clearBrowserPreference();

        // Re-detect browsers and show picker
        const availableBrowsers = detectAvailableBrowsers();
        const pickerResult = await promptBrowserSelection(availableBrowsers);

        if (!pickerResult.ok) {
          if (pickerResult.reason === "cancelled") {
            console.log("\nCancelled.");
            process.exit(0);
          }
          console.error("No browsers available.");
          process.exit(1);
        }

        let retryTokens: { authToken: string; ct0: string } | undefined;
        let retryBrowser: BrowserId | undefined;

        if ("manual" in pickerResult && pickerResult.manual) {
          const manualResult = await promptManualTokenEntry();

          if (!manualResult.ok) {
            process.exit(0);
          }

          retryTokens = manualResult.tokens;

          // Save tokens for next time
          updateConfig({
            authToken: retryTokens.authToken,
            ct0: retryTokens.ct0,
            browser: undefined,
          });
        } else if ("browser" in pickerResult) {
          retryBrowser = pickerResult.browser;

          // Save browser preference
          updateConfig({
            browser: retryBrowser,
            authToken: undefined,
            ct0: undefined,
          });
        }

        // Re-check auth with new credentials
        authResult = await checkAuth({
          authToken: retryTokens?.authToken,
          ct0: retryTokens?.ct0,
          cookieSource: retryBrowser,
          chromeProfile: options.chromeProfile,
          firefoxProfile: options.firefoxProfile,
          skipValidation: options.skipValidation,
        });
      }

      if (!authResult.ok) {
        console.error(authResult.error);
        if (authResult.warnings.length > 0) {
          console.error("\nDetails:\n" + formatWarnings(authResult.warnings));
        }
        process.exit(1);
      }

      // Save tokens after successful browser auth (avoids keychain prompt on next run)
      // Only save if we used browser auth (not manual tokens or CLI args)
      if (browserSource && !manualTokens && !options.authToken) {
        const cookies = authResult.client.getCookies();
        if (cookies.authToken && cookies.ct0) {
          updateConfig({
            browser: browserSource,
            authToken: cookies.authToken,
            ct0: cookies.ct0,
            chromeProfile: options.chromeProfile ?? config.chromeProfile,
            firefoxProfile: options.firefoxProfile ?? config.firefoxProfile,
          });
        }
      }

      // Clear screen before launching TUI (removes any auth flow output)
      process.stdout.write("\x1b[2J\x1b[H");

      // Launch TUI
      const renderer = await createCliRenderer({
        exitOnCtrlC: true,
      });

      createRoot(renderer).render(
        <ModalProvider>
          <App client={authResult.client} user={authResult.user} />
        </ModalProvider>
      );
    }
  );

cli.help();
cli.version("0.1.0");
cli.parse();
