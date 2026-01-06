# OpenTUI Patterns Reference

Advanced patterns learned building xfeed's terminal UI.

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

- [ ] Does it render any HTML elements? -> Need OpenTUI replacements
- [ ] Does it access `window` or `document`? -> May need configuration
- [ ] Does it have default UI components? -> Provide OpenTUI-compatible alternatives
- [ ] Does it use CSS? -> Won't work (use `style` prop instead)

## Modal Pattern

```tsx
function App() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <box style={{ flexGrow: 1 }}>
      {/* Main content - disabled when modal open */}
      <MainScreen focused={!modalOpen} />

      {/* Modal overlay */}
      {modalOpen && (
        <box style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}>
          <box style={{
            border: true,
            padding: 2,
            backgroundColor: "#1a1a2e",
            minWidth: 40,
          }}>
            <Modal focused={true} onClose={() => setModalOpen(false)} />
          </box>
        </box>
      )}
    </box>
  );
}
```

## Loading States Pattern

```tsx
function TimelineScreen({ focused }) {
  const { isLoading, error, data: tweets } = useTimeline();

  if (isLoading) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#666666">Loading...</text>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#ff6b6b">Error: {error.message}</text>
      </box>
    );
  }

  return <PostList posts={tweets} focused={focused} />;
}
```

## Toast/Notification Pattern

```tsx
function Toast({ message, type, visible }) {
  if (!visible) return null;

  const colors = {
    success: "#22c55e",
    error: "#ef4444",
    info: "#3b82f6",
  };

  return (
    <box style={{
      position: "absolute",
      bottom: 2,
      left: "50%",
      backgroundColor: colors[type],
      padding: 1,
      paddingLeft: 2,
      paddingRight: 2,
    }}>
      <text fg="#ffffff">{message}</text>
    </box>
  );
}
```

## Action Feedback Pattern (Visual Pulse)

```tsx
function PostCard({ isLiked, isJustLiked, onLikeClick }) {
  return (
    <text
      fg={
        isJustLiked
          ? "#22c55e"     // Bright green flash
          : isLiked
            ? "#ef4444"   // Red when liked
            : "#666666"   // Muted when not liked
      }
      onMouse={onLikeClick}
    >
      {isLiked ? "\u2665" : "\u2661"}
    </text>
  );
}

// Parent manages the flash timing
function PostList() {
  const [justLiked, setJustLiked] = useState<Set<string>>(new Set());

  const handleLike = (postId: string) => {
    setJustLiked(prev => new Set(prev).add(postId));

    // Clear flash after 200ms
    setTimeout(() => {
      setJustLiked(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }, 200);
  };
}
```

## Tab Switching Pattern

```tsx
function TimelineScreen({ focused }) {
  const [tab, setTab] = useState<"for-you" | "following">("for-you");

  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "1") setTab("for-you");
    if (key.name === "2") setTab("following");
  });

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <box style={{ flexDirection: "row", flexShrink: 0 }}>
        <text fg={tab === "for-you" ? "#1DA1F2" : "#666666"}>[1] For You</text>
        <text>  </text>
        <text fg={tab === "following" ? "#1DA1F2" : "#666666"}>[2] Following</text>
      </box>

      {/* Tab content */}
      {tab === "for-you" && <ForYouTimeline focused={focused} />}
      {tab === "following" && <FollowingTimeline focused={focused} />}
    </box>
  );
}
```

## Error Boundary Pattern

OpenTUI doesn't support React's class-based error boundaries with HTML rendering. Use a functional approach:

```tsx
function SafeComponent({ children, fallback }) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <box style={{ padding: 1 }}>
        <text fg="#ff6b6b">Error: {error.message}</text>
        {fallback}
      </box>
    );
  }

  try {
    return children;
  } catch (e) {
    setError(e as Error);
    return null;
  }
}
```

## Hooks

### useRenderer

```typescript
const renderer = useRenderer();

// Exit the application
renderer.destroy();

// Show console
renderer.console.show();
```

### useTerminalDimensions

```typescript
const { width, height } = useTerminalDimensions();

return (
  <box style={{ width: Math.floor(width / 2) }}>
    <text>Half-width content</text>
  </box>
);
```

### useOnResize

```typescript
useOnResize((width, height) => {
  console.log(`Terminal resized to ${width}x${height}`);
});
```

### useTimeline (Animation)

```typescript
const timeline = useTimeline({
  duration: 2000,
  loop: false,
});

useEffect(() => {
  timeline.add(
    { width: 0 },
    {
      width: 50,
      duration: 2000,
      ease: "linear",
      onUpdate: (animation) => {
        setWidth(animation.targets[0].width);
      },
    }
  );
}, []);
```

## xfeed Reference Implementation Files

- `src/app.tsx` - Screen routing, focus management, navigation history
- `src/components/PostList.tsx` - Scrollbox with scroll preservation, onSelectedIndexChange
- `src/components/PostCard.tsx` - Basic component styling, mouse handling
- `src/modals/FolderPicker.tsx` - Windowed list pattern for modals
- `src/screens/PostDetailScreen.tsx` - Expand/collapse, keyboard shortcuts
- `src/screens/ProfileScreen.tsx` - Collapsible header pattern
- `src/screens/TimelineScreen.tsx` - Loading states, tab switching
- `src/hooks/useListNavigation.ts` - Vim-style navigation hook
- `src/experiments/router-spike.tsx` - TanStack Router integration example
