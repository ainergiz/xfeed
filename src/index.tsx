#!/usr/bin/env bun
import { cac } from "cac";

const cli = cac("xfeed");

cli.command("", "Launch xfeed TUI").action(async () => {
  // TODO: Auth check (#3)
  // TODO: Launch TUI (#5)
  console.log("xfeed - coming soon");
});

cli.help();
cli.version("0.1.0");
cli.parse();
