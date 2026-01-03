import { useKeyboard, useRenderer } from "@opentui/react";

export function SessionExpiredModal() {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "return" || key.name === "q" || key.name === "escape") {
      renderer.destroy();
    }
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <box
        style={{
          borderStyle: "single",
          padding: 2,
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
        backgroundColor="#1a1a2e"
        borderColor="#e63946"
      >
        <text fg="#e63946">Session Expired</text>
        <text fg="#a8a8a8">Your tokens are no longer valid.</text>
        <box style={{ marginTop: 1, flexDirection: "row" }}>
          <text fg="#6b6b6b">Press </text>
          <text fg="#ffffff">Enter</text>
          <text fg="#6b6b6b"> to quit</text>
        </box>
      </box>
    </box>
  );
}
