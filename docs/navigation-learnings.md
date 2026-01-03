# Navigation System Documentation

Comprehensive documentation of all navigation in xfeed - a terminal-based X viewer.

## Table of Contents

1. [Core Navigation Architecture](#1-core-navigation-architecture)
2. [View Types & Structure](#2-view-types--structure)
3. [Post Stack Management](#3-post-stack-management)
4. [Screen-by-Screen Keybindings](#4-screen-by-screen-keybindings)
5. [Modal Navigation](#5-modal-navigation)
6. [Navigation Flow Examples](#6-navigation-flow-examples)
7. [Edge Cases & Special Handling](#7-edge-cases--special-handling)
8. [Complete Keyboard Map](#8-complete-keyboard-map)

---

## 1. Core Navigation Architecture

### The useNavigation Hook

**File:** `src/hooks/useNavigation.ts`

The foundation of navigation is a history stack managed by a React hook:

```typescript
export function useNavigation<V extends string>(options) {
  const [history, setHistory] = useState<V[]>([initialView]);

  const currentView = history[history.length - 1]!;
  const previousView = history.length > 1 ? history[history.length - 2]! : null;
  const canGoBack = history.length > 1;
  const isMainView = mainViews.includes(currentView);

  const navigate = useCallback((view: V) => {
    setHistory((prev) => [...prev, view]);  // PUSH to history
  }, []);

  const goBack = useCallback((): boolean => {
    if (history.length <= 1) return false;
    setHistory((prev) => prev.slice(0, -1));  // POP from history
    return true;
  }, [history.length]);

  const cycleNext = useCallback(() => {
    // REPLACE current view (doesn't add to history)
    const nextIndex = (currentIndex + 1) % mainViews.length;
    setHistory((prev) => [...prev.slice(0, -1), mainViews[nextIndex]]);
  }, [mainViews]);
}
```

**Key behaviors:**
| Method | Action | History Effect |
|--------|--------|----------------|
| `navigate(view)` | Go to new view | Pushes to stack |
| `goBack()` | Return to previous | Pops from stack |
| `cycleNext()` | Cycle main views | Replaces (no push) |

---

## 2. View Types & Structure

**File:** `src/app.tsx` (lines 30-39)

```typescript
export type View =
  | "timeline"      // Main view
  | "bookmarks"     // Main view
  | "notifications" // Main view
  | "post-detail"   // Overlay view
  | "thread"        // Overlay view
  | "profile";      // Overlay view

const MAIN_VIEWS = ["timeline", "bookmarks", "notifications"] as const;
```

### View Categories

| Category | Views | Behavior |
|----------|-------|----------|
| **Main views** | timeline, bookmarks, notifications | Tab-cycleable, top-level |
| **Overlay views** | post-detail, thread, profile | Stack-based, go-back support |

### Screen Mounting Strategy

All screens are kept mounted but hidden to preserve state:

```typescript
<box style={{
  flexGrow: currentView === "timeline" ? 1 : 0,
  height: currentView === "timeline" ? "100%" : 0,
  overflow: "hidden",
}}>
  <TimelineScreen ... />
</box>
```

---

## 3. Post Stack Management

**File:** `src/app.tsx` (lines 162-276)

The post stack is **separate** from the view navigation system. Both must be managed together.

```typescript
const [postStack, setPostStack] = useState<TweetData[]>([]);
const selectedPost = postStack[postStack.length - 1] ?? null;
```

### Stack Operations

#### Push to Stack (Navigate Into)

```typescript
// From timeline/bookmarks/notifications → post detail
const handlePostSelect = useCallback((post: TweetData) => {
  setPostStack((prev) => [...prev, post]);  // Push to post stack
  initState(post.id, post.favorited, post.bookmarked);
  navigate("post-detail");  // Push to view history
}, []);

// From reply → post detail (same as above)
// From quoted tweet → post detail (with async fetch)
// From parent tweet → post detail (with async fetch or go-back)
```

#### Pop from Stack (Navigate Back)

```typescript
const handleBackFromDetail = useCallback(() => {
  goBack();  // Pop view history
  setPostStack((prev) => prev.slice(0, -1));  // Pop post stack
}, [goBack]);
```

### Quote Tweet Navigation (Press `u`)

```typescript
const handleQuoteSelect = useCallback(async (quotedTweet: TweetData) => {
  if (isLoadingQuote) return;

  // Circular navigation check
  if (postStack.some((p) => p.id === quotedTweet.id)) {
    setActionMessage("Already viewing this tweet");
    return;
  }

  setIsLoadingQuote(true);
  try {
    // Embedded quote has partial data - fetch full tweet
    const result = await client.getTweet(quotedTweet.id);
    if (result.success && result.tweet) {
      setPostStack((prev) => [...prev, result.tweet!]);
      initState(result.tweet.id, ...);
      navigate("post-detail");
    }
  } finally {
    setIsLoadingQuote(false);
  }
}, []);
```

### Parent Tweet Navigation (Press `g`)

```typescript
const handleParentSelect = useCallback(async (parentTweet: TweetData) => {
  if (isLoadingParent) return;

  // Check if parent is already in stack (user came from parent → reply)
  const parentIndex = postStack.findIndex((p) => p.id === parentTweet.id);
  if (parentIndex !== -1) {
    // GO BACK to parent instead of fetching
    const itemsToPop = postStack.length - 1 - parentIndex;
    for (let i = 0; i < itemsToPop; i++) {
      goBack();
    }
    setPostStack((prev) => prev.slice(0, parentIndex + 1));
    return;
  }

  // Parent not in stack - fetch and push
  setIsLoadingParent(true);
  try {
    const result = await client.getTweet(parentTweet.id);
    if (result.success && result.tweet) {
      setPostStack((prev) => [...prev, result.tweet!]);
      initState(result.tweet.id, ...);
      navigate("post-detail");
    }
  } finally {
    setIsLoadingParent(false);
  }
}, []);
```

---

## 4. Screen-by-Screen Keybindings

### Root Level (app.tsx)

| Key | Action | Condition |
|-----|--------|-----------|
| `q` | Quit app | Always (even during splash) |
| `Esc` | Back or exit confirmation | On timeline: exit modal. Elsewhere: navigate("timeline") |
| `h` | Vim-style back | Same as Esc |
| `?` | Toggle footer visibility | Always |
| `Tab` | Cycle main views | Only on main views |
| `n` | Go to notifications | Only on main views |

### Timeline Screen

**File:** `src/screens/TimelineScreen.tsx`

| Key | Action |
|-----|--------|
| `1` | Switch to For You tab |
| `2` | Switch to Following tab |
| `r` | Refresh timeline |
| `j/k/g/G/Enter` | List navigation (from PostList) |

### Bookmarks Screen

**File:** `src/screens/BookmarksScreen.tsx`

| Key | Action |
|-----|--------|
| `f` | Open folder picker |
| `r` | Refresh bookmarks |
| `j/k/g/G/Enter` | List navigation |

### Notifications Screen

**File:** `src/screens/NotificationsScreen.tsx`

| Key | Action |
|-----|--------|
| `r` | Refresh notifications |
| `j/k/g/G/Enter` | List navigation |

### Post Detail Screen

**File:** `src/screens/PostDetailScreen.tsx`

| Key | Action | Condition |
|-----|--------|-----------|
| `h/Esc/Backspace` | Go back | - |
| `e` | Expand/collapse text | - |
| `x` | Open tweet on x.com | - |
| `o` | Open external link | hasLinks |
| `l` | Toggle like | - |
| `b` | Toggle bookmark | - |
| `m` | Mentions mode / move to folder | hasMentions or isBookmarked |
| `p` | Open author profile | - |
| `i` | Preview media | hasMedia |
| `d` | Download media | hasMedia |
| `[` / `]` | Previous/next media | hasMedia |
| `,` / `.` | Previous/next link | hasLinks |
| `r` | Enter/exit replies mode | hasReplies |
| `t` | View thread | - |
| `g` | Go to parent tweet | isReply && parentTweet |
| `Enter/u` | Navigate to quoted tweet | hasQuote |

#### Sub-modes in Post Detail

**Mentions Mode** (multiple mentions):
| Key | Action |
|-----|--------|
| `j/k` | Navigate mentions |
| `Enter` | Open mention profile |
| `h/Esc` | Exit mode |

**Replies Mode**:
| Key | Action |
|-----|--------|
| `j/k` | Navigate replies |
| `g/G` | Jump to top/bottom |
| `Enter/u` | View selected reply |
| `h/Esc` | Exit mode |

### Profile Screen

**File:** `src/screens/ProfileScreen.tsx`

| Key | Action |
|-----|--------|
| `h/Esc/Backspace` | Go back |
| `r` | Refresh profile |
| `a` | Preview avatar |
| `v` | Preview banner |
| `w` | Open website |
| `x` | Open profile on x.com |
| `j/k/g/G/Enter` | List navigation |

### Thread Screen

**File:** `src/screens/ThreadScreen.tsx`

| Key | Action |
|-----|--------|
| `h/Esc` | Back to post detail |

---

## 5. Modal Navigation

### Exit Confirmation Modal

| Key | Action |
|-----|--------|
| `y` | Confirm exit |
| `n/Esc` | Cancel |
| `j/↓/Tab` | Next option |
| `k/↑` | Previous option |
| `Enter` | Select highlighted |

### Folder Picker / Bookmark Folder Selector

| Key | Action |
|-----|--------|
| `Esc` | Close modal |
| `j/k/g/G/Enter` | List navigation |

---

## 6. Navigation Flow Examples

### Example 1: Timeline → Quote Tweet → Parent → Back

```
timeline [postStack: []]
  ↓ Enter (select reply tweet A)
post-detail [postStack: [A]]
  ↓ u (navigate to quoted tweet B)
post-detail [postStack: [A, B]]
  ↓ g (navigate to parent tweet C)
post-detail [postStack: [A, B, C]]
  ↓ h (back)
post-detail [postStack: [A, B]]
  ↓ h (back)
post-detail [postStack: [A]]
  ↓ h (back)
timeline [postStack: []]
```

### Example 2: Parent Already in Stack (Smart Go-Back)

```
post-detail [postStack: [Parent]]
  ↓ Enter (click on reply)
post-detail [postStack: [Parent, Reply]]
  ↓ g (go to parent - already in stack!)
post-detail [postStack: [Parent]]  // Goes BACK, doesn't fetch
```

### Example 3: Tab Cycling (No History Push)

```
timeline [history: [timeline]]
  ↓ Tab
bookmarks [history: [bookmarks]]  // Replaced, not pushed
  ↓ Tab
notifications [history: [notifications]]  // Replaced
  ↓ Tab
timeline [history: [timeline]]  // Replaced
```

### Example 4: Notification → Post/Profile

```
notifications
  ↓ Enter (on like notification)
post-detail [opens the liked tweet]

notifications
  ↓ Enter (on follow notification)
profile [opens follower's profile]
```

---

## 7. Edge Cases & Special Handling

### Circular Navigation Prevention

When navigating to quote or parent, check if already in stack:

```typescript
if (postStack.some((p) => p.id === targetTweet.id)) {
  setActionMessage("Already viewing this tweet");
  return;
}
```

### Parent Already in Stack

Special handling: Go back instead of fetching:

```typescript
const parentIndex = postStack.findIndex((p) => p.id === parentTweet.id);
if (parentIndex !== -1) {
  // Pop items to get back to parent
  const itemsToPop = postStack.length - 1 - parentIndex;
  for (let i = 0; i < itemsToPop; i++) {
    goBack();
  }
  setPostStack((prev) => prev.slice(0, parentIndex + 1));
  return;
}
```

### Loading States

Separate loading states prevent double-clicks:
- `isLoadingQuote` - quote tweet navigation
- `isLoadingParent` - parent tweet navigation
- `loadingMoreReplies` - reply pagination

### Replies Mode Keyboard Interception

In replies mode, `g` and `G` are used for jump-to-top/bottom (vim style), NOT parent navigation:

```typescript
if (repliesMode && hasReplies) {
  if (key.name === "g" || key.name === "G" || ...) {
    return;  // Handled by useListNavigation
  }
}
```

### Async Data Fetching

- `quotedTweet` from timeline has **partial data** - must fetch full tweet
- `parentTweet` from usePostDetail has **full data** (already fetched by hook)
- Both require error handling for deleted/protected tweets

### Scroll Position Preservation

PostList and NotificationList save/restore scroll position:
- Save on blur (losing focus)
- Restore on focus
- Auto-scroll selected item into view with asymmetric margins

### Profile Header Collapse

ProfileScreen auto-collapses header when scrolling past first item:

```typescript
const showHeader = selectedIndex === 0 || !user;
```

---

## 8. Complete Keyboard Map

```
╔══════════════════════════════════════════════════════════════════════╗
║                         ROOT LEVEL (all screens)                       ║
╠══════════════════════════════════════════════════════════════════════╣
║  q          Quit app                                                   ║
║  Esc/h      Back or exit confirmation                                  ║
║  ?          Toggle footer                                              ║
║  Tab        Cycle main views (timeline → bookmarks → notifications)    ║
║  n          Jump to notifications                                      ║
╚══════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║                          MAIN VIEWS                                    ║
╠════════════════════╦═════════════════════════════════════════════════╣
║ TIMELINE           ║ BOOKMARKS            ║ NOTIFICATIONS             ║
╠════════════════════╬══════════════════════╬═══════════════════════════╣
║ 1    For You tab   ║ f    Folder picker   ║ r    Refresh              ║
║ 2    Following tab ║ r    Refresh         ║ j/k  Navigate list        ║
║ r    Refresh       ║ j/k  Navigate list   ║ g/G  Top/bottom           ║
║ j/k  Navigate list ║ g/G  Top/bottom      ║ Enter Select notification ║
║ g/G  Top/bottom    ║ Enter Open post      ║                           ║
║ Enter Open post    ║                      ║                           ║
╚════════════════════╩══════════════════════╩═══════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║                          POST DETAIL                                   ║
╠══════════════════════════════════════════════════════════════════════╣
║ h/Esc/Backspace   Back to previous                                    ║
║ e                 Expand/collapse text                                ║
║ x                 Open tweet on x.com                                 ║
║ o                 Open external link (if hasLinks)                    ║
║ l                 Toggle like                                         ║
║ b                 Toggle bookmark                                     ║
║ m                 Mentions mode / move to folder                      ║
║ p                 Open author profile                                 ║
║ i                 Preview media (if hasMedia)                         ║
║ d                 Download media (if hasMedia)                        ║
║ [ / ]             Previous/next media                                 ║
║ , / .             Previous/next link                                  ║
║ r                 Enter/exit replies mode (if hasReplies)             ║
║ t                 View thread                                         ║
║ g                 Go to parent tweet (if isReply)                     ║
║ Enter/u           Navigate to quoted tweet (if hasQuote)              ║
╠══════════════════════════════════════════════════════════════════════╣
║ REPLIES MODE:  j/k navigate, g/G top/bottom, Enter/u view reply       ║
║ MENTIONS MODE: j/k navigate, Enter open profile, h/Esc exit           ║
╚══════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║                            PROFILE                                     ║
╠══════════════════════════════════════════════════════════════════════╣
║ h/Esc/Backspace   Back                                                ║
║ r                 Refresh                                             ║
║ a                 Preview avatar                                      ║
║ v                 Preview banner                                      ║
║ w                 Open website                                        ║
║ x                 Open on x.com                                       ║
║ j/k/g/G/Enter     List navigation                                     ║
╚══════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║                            MODALS                                      ║
╠════════════════════════════╦═════════════════════════════════════════╣
║ EXIT CONFIRMATION          ║ FOLDER PICKER / BOOKMARK SELECTOR       ║
╠════════════════════════════╬═════════════════════════════════════════╣
║ y        Confirm exit      ║ Esc       Close                         ║
║ n/Esc    Cancel            ║ j/k/g/G   Navigate                      ║
║ j/↓/Tab  Next option       ║ Enter     Select                        ║
║ k/↑      Previous option   ║                                         ║
║ Enter    Select            ║                                         ║
╚════════════════════════════╩═════════════════════════════════════════╝
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/hooks/useNavigation.ts` | Core navigation history management |
| `src/hooks/useListNavigation.ts` | j/k/g/G/Enter list navigation |
| `src/hooks/usePostDetail.ts` | Fetches parent tweet and replies |
| `src/app.tsx` | Root navigation orchestration, post stack |
| `src/screens/TimelineScreen.tsx` | Timeline view |
| `src/screens/BookmarksScreen.tsx` | Bookmarks view |
| `src/screens/NotificationsScreen.tsx` | Notifications view |
| `src/screens/PostDetailScreen.tsx` | Post detail view |
| `src/screens/ProfileScreen.tsx` | Profile view |
| `src/screens/ThreadScreen.tsx` | Thread view |
| `src/components/PostList.tsx` | Post list with scroll management |
| `src/components/NotificationList.tsx` | Notification list |
