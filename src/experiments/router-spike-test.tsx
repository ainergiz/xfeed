#!/usr/bin/env bun
/**
 * Router Spike Test Runner
 *
 * Run with: bun src/experiments/router-spike-test.tsx
 *
 * Tests TanStack Router integration with OpenTUI.
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { RouterSpikeWithKeyboard } from "./router-spike";

async function main() {
  console.log("Starting TanStack Router validation spike...\n");

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  createRoot(renderer).render(<RouterSpikeWithKeyboard />);
}

main().catch(console.error);
