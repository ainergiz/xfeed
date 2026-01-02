export function Footer() {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#ffffff">q</text>
      <text fg="#666666"> quit </text>
      <text fg="#ffffff">Tab</text>
      <text fg="#666666"> switch view</text>
    </box>
  );
}
