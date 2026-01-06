# OpenTUI Scrollbox Reference

## Basic Usage

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

## ScrollBoxRenderable API

```typescript
const scrollbox = scrollRef.current;

// Properties
scrollbox.scrollTop          // Current vertical scroll position
scrollbox.scrollHeight       // Total content height
scrollbox.viewport.height    // Visible area height
scrollbox.x                  // X position in parent
scrollbox.y                  // Y position in parent

// Methods
scrollbox.scrollTo(position) // Scroll to absolute position
scrollbox.scrollBy(delta)    // Scroll by relative amount
scrollbox.getChildren()      // Get child renderables (for finding elements)
```

## Finding Elements by ID

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

## Scroll Margin Pattern (vim-style scrolloff)

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

## Scroll Position Preservation

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

### Common Pitfall

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

## Screen Management Pattern

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
      {hasMoreAbove && <text fg="#666666">  ^ more</text>}

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

      {hasMoreBelow && <text fg="#666666">  v more</text>}
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
3. **Clear indicators** - "^ more" / "v more" show users there's more content
4. **Works in any layout** - No dependency on parent container sizing

## Scrollbox Styling Options

```tsx
<scrollbox
  style={{
    rootOptions: {
      backgroundColor: "#24283b",
    },
    wrapperOptions: {
      backgroundColor: "#1f2335",
    },
    viewportOptions: {
      backgroundColor: "#1a1b26",
    },
    contentOptions: {
      backgroundColor: "#16161e",
    },
    scrollbarOptions: {
      showArrows: true,
      trackOptions: {
        foregroundColor: "#7aa2f7",
        backgroundColor: "#414868",
      },
    },
  }}
  focused
>
```

## No onScroll Event

OpenTUI scrollbox **does NOT have an onScroll event**. Don't try to poll `scrollTop` with intervals. Instead, use an event-driven approach based on selection index changes.

See [PATTERNS.md](PATTERNS.md) for the Collapsible Headers pattern.
