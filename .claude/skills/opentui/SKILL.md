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

## Reference Implementation Files

- `src/app.tsx` - Screen routing, focus management, navigation history
- `src/components/PostList.tsx` - Scrollbox with scroll preservation, onSelectedIndexChange
- `src/components/PostCard.tsx` - Basic component styling
- `src/screens/PostDetailScreen.tsx` - Expand/collapse, keyboard shortcuts
- `src/screens/ProfileScreen.tsx` - Collapsible header pattern
- `src/screens/TimelineScreen.tsx` - Loading states, tab switching
- `src/hooks/useListNavigation.ts` - Vim-style navigation hook
- `src/hooks/useTimeline.ts` - Data fetching hook pattern
- `src/hooks/useUserProfile.ts` - Profile data fetching hook
