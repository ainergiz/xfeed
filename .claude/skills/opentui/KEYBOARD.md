# OpenTUI Keyboard Handling Reference

## Basic Pattern

```typescript
import { useKeyboard } from "@opentui/react";

function MyComponent({ focused = false }) {
  useKeyboard((key) => {
    // CRITICAL: Always check focused prop first
    if (!focused) return;

    switch (key.name) {
      case "j":
      case "down":
        handleDown();
        break;
      case "k":
      case "up":
        handleUp();
        break;
      case "return":
        handleEnter();
        break;
      case "escape":
        handleBack();
        break;
      case "g":
        handleTop();       // Lowercase g
        break;
      case "G":
        handleBottom();    // Shift+G (uppercase)
        break;
    }
  });
}
```

## Key Names Reference

| Physical Key | `key.name` |
|--------------|------------|
| Enter | `"return"` |
| Escape | `"escape"` |
| Backspace | `"backspace"` |
| Tab | `"tab"` |
| Space | `"space"` |
| Arrow Up | `"up"` |
| Arrow Down | `"down"` |
| Arrow Left | `"left"` |
| Arrow Right | `"right"` |
| Home | `"home"` |
| End | `"end"` |
| Page Up | `"pageup"` |
| Page Down | `"pagedown"` |
| Delete | `"delete"` |
| Letters | `"a"`, `"b"`, `"j"`, `"k"`, etc. |
| Shift+Letter | `"A"`, `"B"`, `"G"`, etc. (uppercase) |
| Numbers | `"1"`, `"2"`, `"0"`, etc. |

## KeyEvent Object

```typescript
interface KeyEvent {
  name: string;           // Key identifier
  ctrl: boolean;          // Ctrl modifier held
  shift: boolean;         // Shift modifier held
  alt: boolean;           // Alt modifier held
  meta: boolean;          // Meta/Cmd modifier held
  eventType: "press" | "release";  // Press or release event
  repeated: boolean;      // Key is being held (repeat)
}
```

## Modifier Keys

```typescript
useKeyboard((key) => {
  if (!focused) return;

  // Ctrl+key combinations
  if (key.ctrl && key.name === "c") {
    handleCopy();
    return;
  }

  // Alt+key combinations
  if (key.alt && key.name === "left") {
    handleWordLeft();
    return;
  }

  // Meta/Cmd combinations (macOS)
  if (key.meta && key.name === "s") {
    handleSave();
    return;
  }
});
```

## Release Events

By default, `useKeyboard` only receives press events. To also receive release events:

```typescript
import { useKeyboard } from "@opentui/react";
import { useState } from "react";

function App() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useKeyboard(
    (event) => {
      setPressedKeys((keys) => {
        const newKeys = new Set(keys);
        if (event.eventType === "release") {
          newKeys.delete(event.name);
        } else {
          newKeys.add(event.name);
        }
        return newKeys;
      });
    },
    { release: true }  // Enable release events
  );

  return (
    <box>
      <text>Currently pressed: {Array.from(pressedKeys).join(", ") || "none"}</text>
    </box>
  );
}
```

## Focused Prop Pattern

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

## Common Pitfall: Forgetting to Check `focused`

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

## Vim-Style Navigation Hook

xfeed includes a `useListNavigation` hook for vim-style navigation:

```typescript
const { selectedIndex, setSelectedIndex } = useListNavigation({
  itemCount: items.length,
  enabled: focused,  // Only handle keys when focused
  onSelect: (index) => {
    // Called when Enter is pressed
    handleSelect(items[index]);
  },
});
```

**Handles:** `j`/`k`/arrows for movement, `g`/`G` for top/bottom, `Enter` for selection.

See `src/hooks/useListNavigation.ts` for implementation.

## Super+Arrow Keys (Kitty Keyboard Mode)

New in OpenTUI 0.1.64+. In terminals supporting Kitty keyboard protocol:

- `Super+Left` / `Super+Right` - Jump to line start/end in textarea
- Enables more advanced key combinations

## Global Keybindings Pattern

For app-wide keybindings that work regardless of focus:

```tsx
function App() {
  useKeyboard((key) => {
    // Global keybindings - no focus check
    if (key.name === "q") {
      renderer.destroy();  // Quit app
      return;
    }

    // Tab switching
    if (key.name === "1") {
      setCurrentView("timeline");
      return;
    }
    if (key.name === "2") {
      setCurrentView("bookmarks");
      return;
    }
  });

  // Screen-specific handlers check their own focus
  return (
    <>
      <TimelineScreen focused={currentView === "timeline"} />
      <BookmarksScreen focused={currentView === "bookmarks"} />
    </>
  );
}
```

## Key Conflict Resolution

When multiple components register keyboard handlers, they all receive events. Use the focused pattern to ensure only one component acts:

```tsx
// Timeline has j/k for navigation
function TimelineScreen({ focused }) {
  useKeyboard((key) => {
    if (!focused) return;
    if (key.name === "j") selectNext();
  });
}

// Modal also has j/k for its own list
function Modal({ open }) {
  useKeyboard((key) => {
    if (!open) return;
    if (key.name === "j") selectNextInModal();
  });
}

// Parent manages focus state
function App() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <TimelineScreen focused={!modalOpen} />
      {modalOpen && <Modal open={modalOpen} />}
    </>
  );
}
```
