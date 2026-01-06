# OpenTUI Components Reference

## JSX Intrinsic Elements

OpenTUI uses **lowercase intrinsic elements**, NOT React DOM or Ink components:

```tsx
// CORRECT - OpenTUI intrinsics
<box style={{ flexDirection: "column" }}>
  <text fg="#ffffff">Hello</text>
</box>

// WRONG - These are NOT OpenTUI
<div>, <span>, <Box>, <Text>
```

## Available Elements

### Layout & Display

| Element | Purpose | Key Props |
|---------|---------|-----------|
| `<box>` | Container/layout | `style`, `id`, `onMouse`, `onMouseOver`, `onMouseOut` |
| `<text>` | Text content | `fg`, `bg`, `content`, `selectable`, `selectionBg` |
| `<scrollbox>` | Scrollable container | `ref`, `focused`, `style` |
| `<ascii-font>` | ASCII art text | `text`, `font` |

### Input Components

| Element | Purpose | Key Props |
|---------|---------|-----------|
| `<input>` | Text input field | `focused`, `onInput`, `onSubmit`, `placeholder` |
| `<textarea>` | Multi-line text | `ref`, `focused`, `placeholder`, `showCursor` |
| `<select>` | Selection dropdown | `options`, `focused`, `onChange`, `showScrollIndicator` |
| `<tab-select>` | Tab-based selection | `options`, `onChange` |

### Code & Diff Components

| Element | Purpose | Key Props |
|---------|---------|-----------|
| `<code>` | Syntax highlighted code | `content`, `filetype`, `syntaxStyle` |
| `<line-number>` | Code with line numbers | `showLineNumbers`, `fg`, `bg` |
| `<diff>` | Unified/split diff viewer | `content`, `mode` |

### Text Modifiers (inside `<text>` only)

| Element | Effect |
|---------|--------|
| `<span>` | Inline styling container |
| `<strong>`, `<b>` | Bold text |
| `<em>`, `<i>` | Italic text |
| `<u>` | Underlined text |
| `<a>` | Hyperlink (OSC8) |
| `<br>` | Line break |

## Text Nesting Rules

**CRITICAL**: `<text>` only accepts **string children** or text modifiers. You CANNOT nest arbitrary elements inside `<text>`.

```tsx
// WRONG - Cannot nest <text> inside <text>
<text>
  Hello <text fg="red">world</text>
</text>
// Error: TextNodeRenderable only accepts strings, TextNodeRenderable instances, or StyledText instances

// WRONG - Cannot nest <box> inside <text>
<text>
  Count: <box>{count}</box>
</text>

// CORRECT - Use text modifiers inside <text>
<text>
  <strong>Bold</strong>, <em>Italic</em>, and <u>Underlined</u>
</text>

// CORRECT - Use <span> for inline colors inside <text>
<text>
  <span fg="red">Red</span> and <span fg="blue">blue</span>
</text>

// CORRECT - Use row box for separate text elements
<box style={{ flexDirection: "row" }}>
  <text>Hello </text>
  <text fg="red">world</text>
</box>

// CORRECT - Multiple segments with different colors
<box style={{ flexDirection: "row" }}>
  <text fg="#666666">Posted by </text>
  <text fg="#1DA1F2">@username</text>
  <text fg="#666666"> . 2h</text>
</box>
```

**Why this matters**: OpenTUI's `<text>` element maps to `TextNodeRenderable` which only accepts primitive string content or specific inline modifiers. To achieve inline styled text (like colored usernames), wrap multiple `<text>` elements in a `<box>` with `flexDirection: "row"`.

## Hyperlinks (OSC8)

New in OpenTUI 0.1.64+. Renders clickable hyperlinks in terminals that support OSC8 (iTerm2, Kitty, WezTerm, etc.).

```tsx
// Inside <text>
<text>
  Visit <a href="https://example.com">example.com</a> for more info
</text>

// Styled link
<text>
  <u>
    <a href="https://example.com" fg="blue">Click here</a>
  </u>
</text>

// Multiple links
<text>
  Check out <a href="https://github.com">GitHub</a> and <a href="https://x.com">X</a>
</text>
```

## Styling

### Style Prop

Components can be styled using props or the `style` prop:

```tsx
// Direct props
<box backgroundColor="blue" padding={2}>
  <text>Hello, world!</text>
</box>

// Style prop (preferred for complex styles)
<box style={{ backgroundColor: "blue", padding: 2 }}>
  <text>Hello, world!</text>
</box>
```

### Common Style Properties

```tsx
<box
  style={{
    // Layout
    flexDirection: "column",    // "row" | "column"
    flexGrow: 1,                // number
    flexShrink: 0,              // number (use for fixed headers/footers)
    alignItems: "center",       // "flex-start" | "center" | "flex-end" | "stretch"
    justifyContent: "center",   // "flex-start" | "center" | "flex-end" | "space-between"
    gap: 1,                     // spacing between children

    // Dimensions
    height: "100%",             // number | "100%" | "auto"
    width: "100%",
    minHeight: 3,
    minWidth: 10,

    // Spacing (in character units)
    padding: 1,
    paddingLeft: 1,
    paddingRight: 1,
    paddingTop: 1,
    paddingBottom: 1,
    margin: 1,
    marginTop: 1,
    marginBottom: 1,
    marginLeft: 1,
    marginRight: 1,

    // Appearance
    backgroundColor: "#1a1a2e",
    border: true,
    borderStyle: "single",      // "single" | "double" | "round"
    borderColor: "#444444",
    opacity: 0.5,               // 0-1 (new in 0.1.64)
    overflow: "hidden",         // for hiding content
  }}
>
```

### Text Colors

```tsx
<text fg="#1DA1F2">Blue text</text>
<text fg="#ffffff">White text</text>
<text fg="#666666">Gray text</text>
<text bg="#1a1a2e">With background</text>
```

## Selection Indicator Pattern

```tsx
<box style={{ backgroundColor: isSelected ? "#1a1a2e" : undefined }}>
  <text fg="#1DA1F2">{isSelected ? "> " : "  "}</text>
  <text>Content</text>
</box>
```

## Mouse Events

```tsx
import type { MouseEvent } from "@opentui/core";

<box
  onMouse={(event: MouseEvent) => {
    if (event.button !== 0) return;  // Left click only
    if (event.type === "down") { /* Mouse pressed */ }
    if (event.type === "up") { /* Mouse released */ }
    if (event.type === "drag") { /* Mouse dragged */ }
  }}
  onMouseOver={() => setHovered(true)}
  onMouseOut={() => setHovered(false)}
>
```

## Selectable Text

```tsx
<text selectable selectionBg="#264F78">
  This text can be selected with the mouse
</text>
```

## Console Mouse Selection (0.1.61+)

The console component supports mouse selection and scrolling:

```tsx
const renderer = useRenderer();

useEffect(() => {
  renderer.console.show();
  // Optional: handle copy events
  renderer.console.onCopy = (text) => {
    // Copy to system clipboard
  };
}, []);
```
