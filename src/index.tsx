#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { cac } from "cac";

import type { CookieSource } from "@/auth/cookies";

import { App } from "@/app";
import { checkAuth, formatWarnings } from "@/auth/check";

const cli = cac("xfeed");

cli
  .command("", "Launch xfeed TUI")
  .option("--auth-token <token>", "Twitter auth_token cookie")
  .option("--ct0 <token>", "Twitter ct0 cookie (CSRF token)")
  .option(
    "--browser <browser>",
    "Browser to read cookies from (safari, chrome, firefox)"
  )
  .option("--chrome-profile <profile>", "Chrome profile name")
  .option("--firefox-profile <profile>", "Firefox profile name")
  .option("--skip-validation", "Skip API validation of credentials")
  .action(
    async (options: {
      authToken?: string;
      ct0?: string;
      browser?: string;
      chromeProfile?: string;
      firefoxProfile?: string;
      skipValidation?: boolean;
    }) => {
      // Validate browser option if provided
      const validBrowsers = ["safari", "chrome", "firefox"];
      if (options.browser && !validBrowsers.includes(options.browser)) {
        console.error(
          `Invalid browser: ${options.browser}. Must be one of: ${validBrowsers.join(", ")}`
        );
        process.exit(1);
      }

      // Check authentication
      const authResult = await checkAuth({
        authToken: options.authToken,
        ct0: options.ct0,
        cookieSource: options.browser as CookieSource | undefined,
        chromeProfile: options.chromeProfile,
        firefoxProfile: options.firefoxProfile,
        skipValidation: options.skipValidation,
      });

      // Show warnings if any (but not in error case - they're included in the error)
      if (authResult.ok && authResult.warnings.length > 0) {
        console.warn("Warnings:\n" + formatWarnings(authResult.warnings));
      }

      if (!authResult.ok) {
        console.error(authResult.error);
        if (authResult.warnings.length > 0) {
          console.error("\nDetails:\n" + formatWarnings(authResult.warnings));
        }
        process.exit(1);
      }

      // Launch TUI
      const renderer = await createCliRenderer({
        exitOnCtrlC: false,
      });

      createRoot(renderer).render(
        <App client={authResult.client} user={authResult.user} />
      );
    }
  );

cli.help();
cli.version("0.1.0");
cli.parse();
