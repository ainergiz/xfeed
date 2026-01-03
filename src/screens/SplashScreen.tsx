/**
 * SplashScreen - Displays during initial app loading
 * Shows xfeed branding with animated spinner
 */

import { useEffect, useState } from "react";

import { colors } from "@/lib/colors";

// ASCII art logo
const LOGO = [
  "          ██╗  ██╗███████╗███████╗███████╗██████╗ ",
  "          ╚██╗██╔╝██╔════╝██╔════╝██╔════╝██╔══██╗",
  "           ╚███╔╝ █████╗  █████╗  █████╗  ██║  ██║",
  "           ██╔██╗ ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║",
  "          ██╔╝ ██╗██║     ███████╗███████╗██████╔╝",
  "          ╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝╚═════╝ ",
];

const SPINNER_FRAMES = ["◢", "◣", "◤", "◥"];
const SPINNER_INTERVAL_MS = 100;

export function SplashScreen() {
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Top border */}
      <text fg={colors.dim}>{"─".repeat(52)}</text>

      <box style={{ marginTop: 1 }} />

      {/* Logo */}
      {LOGO.map((line, i) => (
        <text key={i} fg="#ffffff">
          {line}
        </text>
      ))}

      <box style={{ marginTop: 1 }} />

      {/* Tagline */}
      <text fg={colors.dim}>{"[terminal client for X, everything app]"}</text>

      <box style={{ marginTop: 1 }} />

      {/* Bottom border */}
      <text fg={colors.dim}>{"─".repeat(52)}</text>

      {/* Spinner and loading text */}
      <box style={{ marginTop: 2, flexDirection: "row" }}>
        <text fg="#ffffff">{SPINNER_FRAMES[spinnerIndex]}</text>
        <text fg={colors.dim}> initializing...</text>
      </box>
    </box>
  );
}
