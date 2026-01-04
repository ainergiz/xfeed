---
name: opentui
description: Build terminal UIs with OpenTUI/React. Use when creating screens, components, handling keyboard input, managing scroll, or navigating between views. Covers JSX intrinsics, useKeyboard, scrollbox patterns, and state preservation.
---

# OpenTUI/React Patterns for xfeed

This skill documents patterns learned building xfeed's terminal UI with `@opentui/react`.

## Quick Reference

```typescript
// Core imports
import { useKeyboard, useRenderer } from "@opentui/react";
import type { ScrollBoxRenderable } from "@opentui/core";

// JSX intrinsics (lowercase, NOT React DOM)
<box>, <text>, <scrollbox>
```

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

### Available Elements

| Element | Purpose | Key Props |
|---------|---------|-----------|
| `<box>` | Container/layout | `style`, `id` |
| `<text>` | Text content | `fg`, `style`, `content` |
| `<scrollbox>` | Scrollable container | `ref`, `focused`, `style` |

### Styling

Styles use a CSS-like object syntax:

```tsx
<box
  style={{
    flexDirection: "column",  // "row" | "column"
    flexGrow: 1,              // number
    flexShrink: 0,            // number (use for fixed headers/footers)
    height: "100%",           // number | "100%" | "auto"
    width: "100%",
    padding: 1,               // number (character units)
    paddingLeft: 1,
    paddingRight: 1,
    paddingTop: 1,
    paddingBottom: 1,
    marginTop: 1,
    marginBottom: 1,
    backgroundColor: "#1a1a2e",
    overflow: "hidden",       // for hiding content
  }}
>
```

### Text Styling

```tsx
<text fg="#1DA1F2">Blue text</text>
<text fg="#ffffff">White text</text>
<text fg="#666666">Gray text</text>
```

### Text Nesting Rules

**CRITICAL**: `<text>` only accepts **string children**. You CANNOT nest elements inside `<text>`.

```tsx
// ❌ WRONG - Cannot nest <text> inside <text>
<text>
  Hello <text fg="red">world</text>
</text>
// Error: TextNodeRenderable only accepts strings, TextNodeRenderable instances, or StyledText instances

// ❌ WRONG - Cannot nest <box> inside <text>
<text>
  Count: <box>{count}</box>
</text>

// ✅ CORRECT - Use row box for inline mixed styling
<box style={{ flexDirection: "row" }}>
  <text>Hello </text>
  <text fg="red">world</text>
</box>

// ✅ CORRECT - Multiple segments with different colors
<box style={{ flexDirection: "row" }}>
  <text fg="#666666">Posted by </text>
  <text fg="#1DA1F2">@username</text>
  <text fg="#666666"> · 2h</text>
</box>
```

**Why this matters**: OpenTUI's `<text>` element maps to `TextNodeRenderable` which only accepts primitive string content. To achieve inline styled text (like colored usernames), wrap multiple `<text>` elements in a `<box>` with `flexDirection: "row"`.

## Keyboard Handling

### Basic Pattern

```typescript
import { useKeyboard } from "@opentui/react";

function MyComponent({ focused = false }) {
  useKeyboard((key) => {
    // CRITICAL: Always check focused prop first
    if (!focused) return;

    switch (key.name) {
      case "j":
      case "down":
        // Handle down
        break;
      case "k":
      case "up":
        // Handle up
        break;
      case "return":
        // Handle Enter
        break;
      case "escape":
        // Handle Escape
        break;
      case "g":
        // Lowercase g
        break;
      case "G":
        // Shift+G (uppercase)
        break;
    }
  });
}
```

### Key Names Reference

| Physical Key | `key.name` |
|--------------|------------|
| Enter | `"return"` |
| Escape | `"escape"` |
| Backspace | `"backspace"` |
| Tab | `"tab"` |
| Arrow Up | `"up"` |
| Arrow Down | `"down"` |
| Arrow Left | `"left"` |
| Arrow Right | `"right"` |
| Letters | `"a"`, `"b"`, `"j"`, `"k"`, etc. |
| Shift+Letter | `"A"`, `"B"`, `"G"`, etc. (uppercase) |
| Numbers | `"1"`, `"2"`, etc. |

### Focused Prop Pattern

**CRITICAL**: Pass a `focused` prop to control which component handles keyboard input:

```tsx
// Parent component controls focus
function App() {
  const [currentView, setCurrentView] = useState("timeline");

  return (
    <>
      <TimelineScreen focused={currentView === "timeline"} />
      <DetailScreen focused={currentView === "detail"} />
    </>
  );
}

// Child component checks focused before handling keys
function TimelineScreen({ focused }) {
  useKeyboard((key) => {
    if (!focused) return;  // MUST check this first
    // Handle keys...
  });
}
```

## Scrollbox

### Basic Usage

```tsx
import type { ScrollBoxRenderable } from "@opentui/core";
import { useRef } from "react";

function ScrollableList() {
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  return (
    <scrollbox
      ref={scrollRef}
      focused={true}
      style={{
        flexGrow: 1,
        height: "100%",
      }}
    >
      {items.map((item) => (
        <ItemCard key={item.id} id={`item-${item.id}`} />
      ))}
    </scrollbox>
  );
}
```

### ScrollBoxRenderable API

```typescript
const scrollbox = scrollRef.current;

// Properties
scrollbox.scrollTop          // Current vertical scroll position
scrollbox.scrollHeight       // Total content height
scrollbox.viewport.height    // Visible area height

// Methods
scrollbox.scrollTo(position) // Scroll to absolute position
scrollbox.scrollBy(delta)    // Scroll by relative amount
scrollbox.getChildren()      // Get child renderables (for finding elements)
```

### Finding Elements by ID

```tsx
// Give elements IDs for scroll targeting
<ItemCard id={`item-${item.id}`} />

// Find element and scroll to it
const target = scrollbox.getChildren().find((child) => child.id === targetId);
if (target) {
  const relativeY = target.y - scrollbox.y;
  // Use relativeY for scroll calculations
}
```

### Scroll Margin Pattern (vim-style scrolloff)

Keep selected items visible with context around them:

```typescript
useEffect(() => {
  const scrollbox = scrollRef.current;
  if (!scrollbox) return;

  const target = scrollbox.getChildren().find((c) => c.id === selectedId);
  if (!target) return;

  const relativeY = target.y - scrollbox.y;
  const viewportHeight = scrollbox.viewport.height;

  // Asymmetric margins - bias selection toward top
  const topMargin = Math.max(1, Math.floor(viewportHeight / 10));    // ~10%
  const bottomMargin = Math.max(4, Math.floor(viewportHeight / 3));  // ~33%

  // First item: scroll to top
  if (selectedIndex === 0) {
    scrollbox.scrollTo(0);
    return;
  }

  // Last item: scroll to bottom
  if (selectedIndex === items.length - 1) {
    scrollbox.scrollTo(scrollbox.scrollHeight);
    return;
  }

  // Scroll to keep selection visible with margins
  if (relativeY + target.height > viewportHeight - bottomMargin) {
    scrollbox.scrollBy(relativeY + target.height - viewportHeight + bottomMargin);
  } else if (relativeY < topMargin) {
    scrollbox.scrollBy(relativeY - topMargin);
  }
}, [selectedIndex]);
```

## Windowed Lists for Modals

### The Problem

Scrollbox works well for full-screen lists (like PostList, NotificationList) where it fills the available space with `height: "100%"` and `flexGrow: 1`. However, **constraining scrollbox height in modals is problematic**:

- Setting numeric `height` on scrollbox doesn't constrain the viewport correctly
- Wrapping scrollbox in a fixed-height container causes layout issues
- The scrollbar position and content rendering become misaligned

### Solution: Windowed List Pattern

For modals with bounded lists (like folder pickers), use a **windowed list** instead of scrollbox:

```tsx
const MAX_VISIBLE_ITEMS = 10;

function PickerModal({ items, onSelect }) {
  const [windowStart, setWindowStart] = useState(0);

  const { selectedIndex } = useListNavigation({
    itemCount: items.length,
    onSelect: (index) => onSelect(items[index]),
  });

  // Keep selected item within the visible window
  useEffect(() => {
    const windowEnd = windowStart + MAX_VISIBLE_ITEMS - 1;

    // If selection is below the window, shift window down
    if (selectedIndex > windowEnd) {
      setWindowStart(selectedIndex - MAX_VISIBLE_ITEMS + 1);
    }
    // If selection is above the window, shift window up
    else if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    }
  }, [selectedIndex, windowStart]);

  // Calculate visible items
  const hasMoreAbove = windowStart > 0;
  const hasMoreBelow = windowStart + MAX_VISIBLE_ITEMS < items.length;
  const visibleItems = items.slice(windowStart, windowStart + MAX_VISIBLE_ITEMS);

  return (
    <box style={{ /* modal styles */ }}>
      {hasMoreAbove && <text fg="#666666">  ↑ more</text>}

      {visibleItems.map((item, visibleIndex) => {
        const actualIndex = windowStart + visibleIndex;
        const isSelected = actualIndex === selectedIndex;
        return (
          <box key={item.id}>
            <text fg={isSelected ? "#1DA1F2" : "#888888"}>
              {isSelected ? "> " : "  "}{item.name}
            </text>
          </box>
        );
      })}

      {hasMoreBelow && <text fg="#666666">  ↓ more</text>}
    </box>
  );
}
```

### When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| **Scrollbox** | Full-screen lists that fill available space (timeline, notifications) |
| **Windowed List** | Modals/dialogs with bounded height (folder picker, search results) |

### Key Benefits of Windowed Lists

1. **Predictable sizing** - No complex scrollbox height constraints
2. **Simple implementation** - Just slice the array and track window position
3. **Clear indicators** - "↑ more" / "↓ more" show users there's more content
4. **Works in any layout** - No dependency on parent container sizing

### Reference Implementation

- `src/components/FolderPicker.tsx` - Windowed list pattern for folder selection modal

## Screen Navigation & State Preservation

### The Problem

When switching screens, you might try to hide components with `height: 0`. But this causes **scroll position loss** because:

1. React re-renders, setting parent height to 0
2. Scrollbox viewport shrinks to 0
3. Scroll position gets clamped to 0
4. `useEffect` runs AFTER render, too late to save position

### Solution: Save Synchronously Before State Change

```tsx
function PostList({ focused, onPostSelect }) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const savedScrollTop = useRef(0);
  const wasFocused = useRef(focused);

  // Restore scroll position when GAINING focus
  useEffect(() => {
    if (!wasFocused.current && focused && savedScrollTop.current > 0) {
      scrollRef.current?.scrollTo(savedScrollTop.current);
    }
    wasFocused.current = focused;
  }, [focused]);

  const { selectedIndex } = useListNavigation({
    onSelect: (index) => {
      // CRITICAL: Save scroll position SYNCHRONOUSLY
      // before the callback triggers any state change
      if (scrollRef.current) {
        savedScrollTop.current = scrollRef.current.scrollTop;
      }
      onPostSelect?.(items[index]);
    },
  });
}
```

### Screen Management Pattern

Keep screens mounted but hidden to preserve state:

```tsx
function App() {
  const [currentView, setCurrentView] = useState("timeline");

  return (
    <box style={{ flexGrow: 1 }}>
      {/* Keep mounted, hide with height: 0 */}
      <box
        style={{
          flexGrow: currentView === "timeline" ? 1 : 0,
          height: currentView === "timeline" ? "100%" : 0,
          overflow: "hidden",
        }}
      >
        <TimelineScreen focused={currentView === "timeline"} />
      </box>

      {/* Conditionally render overlay screens */}
      {currentView === "detail" && (
        <DetailScreen focused={true} onBack={() => setCurrentView("timeline")} />
      )}
    </box>
  );
}
```

## Flex Layout & Spacing (Yoga Engine)

OpenTUI uses the **Yoga layout engine** (same as React Native). Understanding Yoga's behavior is critical for debugging spacing issues.

### Default Flex Behavior

```typescript
// DEFAULT VALUES (if not specified)
flexGrow: 0      // Children don't grow to fill space
flexShrink: 1    // Children CAN shrink (for auto-sized elements)
flexShrink: 0    // Auto-set when explicit width/height is provided

// alignItems default is "stretch" (cross-axis)
// justifyContent default is "flex-start" (main-axis)
```

**Key insight:** If you set explicit `width` or `height`, OpenTUI automatically sets `flexShrink: 0` to prevent unwanted shrinking.

### Preventing Unwanted Spacing

Extra space between flex children often comes from:
1. Implicit margins/padding (even if not explicitly set)
2. Flex distribution allocating space to children
3. Text elements with trailing whitespace

**Solution: Explicit Zero Values**

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

### Debugging Spacing Issues

1. **Check for implicit values** - Yoga may apply defaults you don't expect
2. **Add explicit zeros** - `marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0`
3. **Use justifyContent** - `"flex-start"` packs children at start of main axis
4. **Check text content** - Use `.trim()` on user-provided text to remove trailing whitespace
5. **Inspect parent containers** - Spacing can come from parent flex distribution

### Gap Property (Preferred for Intentional Spacing)

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

## Layout Patterns

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

### Keyboard Shortcuts Footer

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

### Selection Indicator

```tsx
<box style={{ backgroundColor: isSelected ? "#1a1a2e" : undefined }}>
  <text fg="#1DA1F2">{isSelected ? "> " : "  "}</text>
  <text>Content</text>
</box>
```

## Hooks

### useListNavigation (vim-style)

```typescript
const { selectedIndex, setSelectedIndex } = useListNavigation({
  itemCount: items.length,
  enabled: focused,  // Only handle keys when focused
  onSelect: (index) => {
    // Called when Enter is pressed
  },
});
```

Handles: `j`/`k`/arrows for movement, `g`/`G` for top/bottom, `Enter` for selection.

### useKeyboard

```typescript
useKeyboard((key) => {
  // key.name - the key identifier
  // key.ctrl - boolean for ctrl modifier
  // key.shift - boolean for shift modifier
});
```

### useRenderer

```typescript
const renderer = useRenderer();

// Exit the application
renderer.destroy();
```

## Common Pitfalls

### 1. Forgetting to check `focused` prop

```typescript
// WRONG - will handle keys even when another screen is focused
useKeyboard((key) => {
  if (key.name === "escape") handleBack();
});

// CORRECT
useKeyboard((key) => {
  if (!focused) return;  // Check first!
  if (key.name === "escape") handleBack();
});
```

### 2. Using React DOM elements

```tsx
// WRONG
<div><span>Text</span></div>

// CORRECT
<box><text>Text</text></box>
```

### 3. Saving scroll position in useEffect

```typescript
// WRONG - useEffect runs AFTER render, scroll already reset
useEffect(() => {
  if (!focused) {
    savedScrollTop.current = scrollRef.current?.scrollTop;  // Already 0!
  }
}, [focused]);

// CORRECT - save synchronously before state change
onSelect: () => {
  savedScrollTop.current = scrollRef.current?.scrollTop;  // Still valid
  triggerStateChange();
}
```

### 4. Non-memoized callbacks in hooks

```typescript
// WRONG - creates new function every render, breaks useEffect deps
return {
  setSelectedIndex: (val) => { /* ... */ }
};

// CORRECT - memoize with useCallback
const setSelectedIndexMemo = useCallback((val) => { /* ... */ }, [deps]);
return { setSelectedIndex: setSelectedIndexMemo };
```

### 5. Unexpected spacing between flex children

```tsx
// WRONG - implicit spacing may appear
<box style={{ flexDirection: "column" }}>
  <text>Header</text>
  <text>─────────</text>  {/* Mysterious gap above this! */}
  <text>Content</text>
</box>

// CORRECT - explicit zero spacing when needed
<box
  style={{
    flexDirection: "column",
    justifyContent: "flex-start",
    marginBottom: 0,
    paddingBottom: 0,
  }}
>
  <text>Header</text>
  <box style={{ marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}>
    <text>─────────</text>
  </box>
  <text>Content</text>
</box>
```

### 6. Nesting elements inside `<text>`

```tsx
// WRONG - <text> only accepts string children
<text>
  Username: <text fg={colors.primary}>@{username}</text>
</text>
// Error: TextNodeRenderable only accepts strings...

// CORRECT - use row box for inline styling
<box style={{ flexDirection: "row" }}>
  <text>Username: </text>
  <text fg={colors.primary}>@{username}</text>
</box>
```

## Collapsible Headers (Scroll-Based UI)

OpenTUI scrollbox **does NOT have an onScroll event**. Don't try to poll `scrollTop` with intervals. Instead, use an event-driven approach based on selection index.

### Pattern: Selection-Based Header Collapse

```tsx
// PostList exposes selection changes via callback
interface PostListProps {
  posts: TweetData[];
  focused?: boolean;
  onPostSelect?: (post: TweetData) => void;
  onSelectedIndexChange?: (index: number) => void;  // NEW
}

// In PostList component
useEffect(() => {
  onSelectedIndexChange?.(selectedIndex);
}, [selectedIndex, onSelectedIndexChange]);
```

```tsx
// Parent component tracks collapsed state
function ProfileScreen({ focused, onBack }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSelectedIndexChange = useCallback((index: number) => {
    setIsCollapsed(index > 0);  // Collapse when scrolled past first item
  }, []);

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {isCollapsed ? <CompactHeader /> : <FullHeader />}
      <PostList
        posts={tweets}
        focused={focused}
        onSelectedIndexChange={handleSelectedIndexChange}
      />
    </box>
  );
}
```

**Why this works:** Selection changes only happen via keyboard navigation (j/k). This is event-driven and efficient - no polling needed.

## Navigation History

For proper back navigation across multiple views, track where you came from:

### Pattern: Previous View Tracking

```tsx
function App() {
  const [currentView, setCurrentView] = useState<View>("timeline");
  const [selectedPost, setSelectedPost] = useState<TweetData | null>(null);

  // Track where we came from when entering post-detail
  const [postDetailPreviousView, setPostDetailPreviousView] = useState<
    "timeline" | "profile"
  >("timeline");

  // Navigate to post-detail from timeline
  const handlePostSelect = useCallback((post: TweetData) => {
    setSelectedPost(post);
    setPostDetailPreviousView("timeline");
    setCurrentView("post-detail");
  }, []);

  // Navigate to post-detail from profile
  const handlePostSelectFromProfile = useCallback((post: TweetData) => {
    setSelectedPost(post);
    setPostDetailPreviousView("profile");  // Remember we came from profile
    setCurrentView("post-detail");
  }, []);

  // Return from post-detail to WHEREVER we came from
  const handleBackFromDetail = useCallback(() => {
    setCurrentView(postDetailPreviousView);  // Go back to correct view
    setSelectedPost(null);
  }, [postDetailPreviousView]);
}
```

**Common mistake:** Hardcoding `setCurrentView("timeline")` in back handlers. This breaks navigation when entering the same view from multiple sources.

## Third-Party Library Compatibility

OpenTUI uses a custom React reconciler, NOT React DOM. This means:

1. **HTML elements are not supported** - Libraries that render `<div>`, `<span>`, `<strong>`, etc. will crash
2. **window/document are undefined** - Libraries assuming browser environment need configuration
3. **Default components may use HTML** - Libraries with fallback UIs (error boundaries, loading states) need OpenTUI-compatible replacements

### TanStack Router Example

TanStack Router works with OpenTUI but requires:

```typescript
import { createMemoryHistory, createRouter } from "@tanstack/react-router";

// OpenTUI-compatible default components (replace HTML defaults)
function DefaultPendingComponent() {
  return <box style={{ padding: 1 }}><text>Loading...</text></box>;
}

function DefaultErrorComponent({ error }: { error: unknown }) {
  return <box style={{ padding: 1 }}><text fg="#ff0000">Error: {String(error)}</text></box>;
}

function DefaultNotFoundComponent() {
  return <box style={{ padding: 1 }}><text>Not found</text></box>;
}

// Memory history (no browser)
const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

// Router with TUI-specific config
const router = createRouter({
  routeTree,
  history: memoryHistory,
  isServer: false,                              // We're not on a server
  origin: "http://localhost",                   // Prevents window.origin access
  defaultPendingComponent: DefaultPendingComponent,
  defaultErrorComponent: DefaultErrorComponent,
  defaultNotFoundComponent: DefaultNotFoundComponent,
});
```

### TanStack Query

TanStack Query works out-of-the-box since it's headless (no UI components).

### General Compatibility Checklist

Before using a React library with OpenTUI:

- [ ] Does it render any HTML elements? → Need OpenTUI replacements
- [ ] Does it access `window` or `document`? → May need configuration
- [ ] Does it have default UI components? → Provide OpenTUI-compatible alternatives
- [ ] Does it use CSS? → Won't work (use `style` prop instead)

## Reference Implementation Files

- `src/app.tsx` - Screen routing, focus management, navigation history
- `src/components/PostList.tsx` - Scrollbox with scroll preservation, onSelectedIndexChange
- `src/components/PostCard.tsx` - Basic component styling
- `src/components/FolderPicker.tsx` - Windowed list pattern for modals
- `src/screens/PostDetailScreen.tsx` - Expand/collapse, keyboard shortcuts
- `src/screens/ProfileScreen.tsx` - Collapsible header pattern
- `src/screens/TimelineScreen.tsx` - Loading states, tab switching
- `src/hooks/useListNavigation.ts` - Vim-style navigation hook
- `src/hooks/useTimeline.ts` - Data fetching hook pattern
- `src/hooks/useUserProfile.ts` - Profile data fetching hook
- `src/experiments/router-spike.tsx` - TanStack Router integration example
