/**
 * SplashScreen - Displays during initial app loading
 * Shows xfeed branding with animated spinner
 */

import { useEffect, useState } from "react";

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

const PRIMARY = "#ffffff"; // White
const DIM = "#666666"; // Gray

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
      <text fg={DIM}>{"─".repeat(52)}</text>

      <box style={{ marginTop: 1 }} />

      {/* Logo */}
      {LOGO.map((line, i) => (
        <text key={i} fg={PRIMARY}>
          {line}
        </text>
      ))}

      <box style={{ marginTop: 1 }} />

      {/* Tagline */}
      <text fg={DIM}>{"[terminal client for X, everything app]"}</text>

      <box style={{ marginTop: 1 }} />

      {/* Bottom border */}
      <text fg={DIM}>{"─".repeat(52)}</text>

      {/* Spinner and loading text */}
      <box style={{ marginTop: 2, flexDirection: "row" }}>
        <text fg={PRIMARY}>{SPINNER_FRAMES[spinnerIndex]}</text>
        <text fg={DIM}> initializing...</text>
      </box>
    </box>
  );
}
