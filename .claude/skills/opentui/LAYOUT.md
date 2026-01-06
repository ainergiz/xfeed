# OpenTUI Layout Reference (Yoga Engine)

OpenTUI uses the **Yoga layout engine** (same as React Native). Understanding Yoga's behavior is critical for debugging spacing issues.

## Default Flex Behavior

```typescript
// DEFAULT VALUES (if not specified)
flexGrow: 0      // Children don't grow to fill space
flexShrink: 1    // Children CAN shrink (for auto-sized elements)
flexShrink: 0    // Auto-set when explicit width/height is provided

// alignItems default is "stretch" (cross-axis)
// justifyContent default is "flex-start" (main-axis)
```

**Key insight:** If you set explicit `width` or `height`, OpenTUI automatically sets `flexShrink: 0` to prevent unwanted shrinking.

## Common Layout Patterns

### Full-Height Screen with Header/Footer

```tsx
<box style={{ flexDirection: "column", height: "100%" }}>
  {/* Fixed header */}
  <box style={{ flexShrink: 0, padding: 1 }}>
    <text>Header</text>
  </box>

  {/* Scrollable content */}
  <scrollbox style={{ flexGrow: 1, height: "100%" }}>
    {/* Content */}
  </scrollbox>

  {/* Fixed footer */}
  <box style={{ flexShrink: 0, padding: 1 }}>
    <text>Footer</text>
  </box>
</box>
```

### Row Layout (Inline Elements)

```tsx
<box style={{ flexDirection: "row" }}>
  <text>Label: </text>
  <text fg="#1DA1F2">Value</text>
</box>
```

### Centered Content

```tsx
<box style={{
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
}}>
  <text>Centered</text>
</box>
```

### Space Between Items

```tsx
<box style={{
  flexDirection: "row",
  justifyContent: "space-between",
  width: "100%",
}}>
  <text>Left</text>
  <text>Right</text>
</box>
```

## Preventing Unwanted Spacing

Extra space between flex children often comes from:
1. Implicit margins/padding (even if not explicitly set)
2. Flex distribution allocating space to children
3. Text elements with trailing whitespace

### Solution: Explicit Zero Values

```tsx
// When you need tight layout with NO gaps between children
<box
  style={{
    flexDirection: "column",
    justifyContent: "flex-start",  // Pack children at top
    marginBottom: 0,               // Explicit zero margin
    paddingBottom: 0,              // Explicit zero padding
  }}
>
  {/* Child content */}
</box>
```

### Real-World Example: Profile Header Spacing Bug

**Problem:** Extra blank line appearing between profile header content and separator line.

**Investigation revealed:**
- fullHeader box had no explicit bottom margin/padding
- separator had no explicit top margin/padding
- Yet a blank line appeared between them

**Solution:**
```tsx
// Profile header - pack children at top with explicit zero spacing
const fullHeader = (
  <box
    style={{
      flexShrink: 0,
      flexDirection: "column",
      justifyContent: "flex-start",  // Critical!
      marginBottom: 0,
      paddingBottom: 0,
    }}
  >
    {/* header content */}
  </box>
);

// Separator - explicit zero margins
const separator = (
  <box
    style={{
      paddingLeft: 1,
      paddingRight: 1,
      flexShrink: 0,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
    }}
  >
    <text fg="#444444">{"─".repeat(50)}</text>
  </box>
);
```

## Debugging Spacing Issues

1. **Check for implicit values** - Yoga may apply defaults you don't expect
2. **Add explicit zeros** - `marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0`
3. **Use justifyContent** - `"flex-start"` packs children at start of main axis
4. **Check text content** - Use `.trim()` on user-provided text to remove trailing whitespace
5. **Inspect parent containers** - Spacing can come from parent flex distribution

## Gap Property (Preferred for Intentional Spacing)

When you DO want spacing between children, use `gap` instead of margins:

```tsx
<box
  style={{
    flexDirection: "column",
    gap: 1,  // 1 line gap between all children
  }}
>
  <text>Item 1</text>
  <text>Item 2</text>
  <text>Item 3</text>
</box>
```

`gap` is cleaner than adding `marginBottom` to each child because:
- It doesn't apply to the last child
- It's a single property on the parent
- It's more explicit about intent

## Flex Properties Reference

| Property | Values | Description |
|----------|--------|-------------|
| `flexDirection` | `"row"`, `"column"` | Main axis direction |
| `flexGrow` | number | How much to grow relative to siblings |
| `flexShrink` | number | How much to shrink relative to siblings |
| `flexBasis` | number, `"auto"` | Initial size before grow/shrink |
| `alignItems` | `"flex-start"`, `"center"`, `"flex-end"`, `"stretch"` | Cross-axis alignment |
| `alignSelf` | same as alignItems | Override parent's alignItems |
| `justifyContent` | `"flex-start"`, `"center"`, `"flex-end"`, `"space-between"`, `"space-around"` | Main-axis distribution |
| `flexWrap` | `"nowrap"`, `"wrap"` | Whether to wrap children |
| `gap` | number | Space between children |

## Dimension Properties

| Property | Values | Description |
|----------|--------|-------------|
| `width` | number, `"100%"`, `"auto"` | Element width |
| `height` | number, `"100%"`, `"auto"` | Element height |
| `minWidth` | number | Minimum width |
| `maxWidth` | number | Maximum width |
| `minHeight` | number | Minimum height |
| `maxHeight` | number | Maximum height |

## Spacing Properties

All spacing values are in **character units** (not pixels):

| Property | Description |
|----------|-------------|
| `padding` | All sides |
| `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight` | Individual sides |
| `paddingHorizontal` | Left and right |
| `paddingVertical` | Top and bottom |
| `margin` | All sides |
| `marginTop`, `marginBottom`, `marginLeft`, `marginRight` | Individual sides |
| `marginHorizontal` | Left and right |
| `marginVertical` | Top and bottom |

## Opacity Property (0.1.64+)

```tsx
<box style={{ opacity: 0.5 }}>
  <text>50% opacity</text>
</box>
```

Useful for dimming/fading effects, disabled states, or overlays.

## Overflow

```tsx
<box style={{ overflow: "hidden" }}>
  {/* Content that exceeds bounds will be clipped */}
</box>
```

## Absolute Positioning (0.1.62+)

Absolute positioned elements now position relative to parent:

```tsx
<box style={{ position: "relative", width: 50, height: 20 }}>
  <box style={{
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 3,
  }}>
    <text>Badge</text>
  </box>
</box>
```

## Keyboard Shortcuts Footer Pattern

```tsx
function Footer() {
  return (
    <box style={{ flexShrink: 0, paddingLeft: 1, flexDirection: "row" }}>
      <text fg="#ffffff">j/k</text>
      <text fg="#666666"> nav </text>
      <text fg="#ffffff">Enter</text>
      <text fg="#666666"> select </text>
      <text fg="#ffffff">q</text>
      <text fg="#666666"> quit</text>
    </box>
  );
}
```
