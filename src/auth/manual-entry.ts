import { createInterface } from "node:readline";

import { checkAuth } from "./check";

export interface ManualTokens {
  authToken: string;
  ct0: string;
}

export interface ManualEntryResult {
  ok: true;
  tokens: ManualTokens;
}

export interface ManualEntryCancelled {
  ok: false;
  reason: "cancelled";
}

/**
 * Prompt user to manually enter auth tokens.
 * Validates tokens before accepting them.
 */
export async function promptManualTokenEntry(): Promise<
  ManualEntryResult | ManualEntryCancelled
> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let cancelled = false;

  // Handle Ctrl+C
  rl.on("close", () => {
    cancelled = true;
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│  Manual Token Entry                                     │");
  console.log("└─────────────────────────────────────────────────────────┘\n");
  console.log("To get your tokens:");
  console.log("  1. Open x.com in your browser and log in");
  console.log("  2. Open DevTools (Cmd+Option+I or F12)");
  console.log("  3. Go to Application tab → Cookies → https://x.com");
  console.log("  4. Find 'auth_token' and 'ct0' rows, copy their values\n");

  // Loop until valid tokens or cancelled
  while (!cancelled) {
    const authToken = await question("auth_token: ");
    if (authToken === "" || cancelled) {
      console.log("\nCancelled.");
      rl.close();
      return { ok: false, reason: "cancelled" };
    }

    const ct0 = await question("ct0: ");
    if (ct0 === "" || cancelled) {
      console.log("\nCancelled.");
      rl.close();
      return { ok: false, reason: "cancelled" };
    }

    // Validate tokens
    console.log("\nValidating...");
    const result = await checkAuth({ authToken, ct0 });

    if (result.ok) {
      console.log("Tokens valid.\n");
      rl.close();
      return { ok: true, tokens: { authToken, ct0 } };
    }

    // Show error and retry
    console.log(`\nInvalid tokens: ${result.error}\n`);
    console.log("Try again or press Enter to cancel.\n");
  }

  rl.close();
  return { ok: false, reason: "cancelled" };
}
