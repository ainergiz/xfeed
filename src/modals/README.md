# Modal System

Type-safe modal management using React Context with discriminated unions.

## Usage

### Opening a Modal

```typescript
import { useModal } from "@/contexts/ModalContext";

function MyComponent() {
  const { openModal, closeModal } = useModal();

  const handleClick = () => {
    openModal("exit-confirmation", {
      onConfirm: () => console.log("Confirmed!"),
      onCancel: closeModal,
    });
  };
}
```

### Available Modal Types

| Type                       | Props                                            | Description                    |
| -------------------------- | ------------------------------------------------ | ------------------------------ |
| `folder-picker`            | `client`, `tweet`, `onSelect`, `onClose`         | Move bookmark to folder        |
| `bookmark-folder-selector` | `client`, `currentFolder`, `onSelect`, `onClose` | Select folder to view          |
| `exit-confirmation`        | `onConfirm`, `onCancel`                          | Confirm app exit               |
| `session-expired`          | none                                             | Terminal session expired state |

### Context Values

```typescript
const {
  openModal,      // Open a modal with type-safe props
  closeModal,     // Close current modal (no-op for session-expired)
  isModalOpen,    // Boolean for keyboard gating
  activeModal,    // Current modal state (for advanced use)
} = useModal();
```

## Adding a New Modal

### 1. Create the modal component

```typescript
// src/modals/MyNewModal.tsx
import { useKeyboard } from "@opentui/react";

interface MyNewModalProps {
  someData: string;
  onConfirm: () => void;
  onClose: () => void;
  focused?: boolean;
}

export function MyNewModal({ someData, onConfirm, onClose, focused = true }: MyNewModalProps) {
  useKeyboard((key) => {
    if (!focused) return;  // Always guard with focused

    if (key.name === "escape") onClose();
    if (key.name === "return") onConfirm();
  });

  return (
    <box style={{ /* modal styling */ }}>
      {/* Modal content */}
    </box>
  );
}
```

### 2. Add types to ModalContext

```typescript
// src/contexts/ModalContext.tsx

// Add props interface
export interface MyNewModalProps {
  someData: string;
  onConfirm: () => void;
  onClose: () => void;
}

// Add to ModalType union
export type ModalType =
  | "folder-picker"
  | "bookmark-folder-selector"
  | "exit-confirmation"
  | "session-expired"
  | "my-new-modal";  // Add here

// Add to ModalPropsMap
export interface ModalPropsMap {
  // ... existing entries
  "my-new-modal": MyNewModalProps;
}

// Add to ModalState union
export type ModalState =
  // ... existing entries
  | { type: "my-new-modal"; props: MyNewModalProps }
  | null;
```

### 3. Add to ModalRenderer switch

```typescript
// In ModalRenderer component
case "my-new-modal":
  return (
    <ModalWrapper>
      <MyNewModal {...activeModal.props} focused={true} />
    </ModalWrapper>
  );
```

### 4. Export from index

```typescript
// src/modals/index.ts
export { MyNewModal } from "./MyNewModal";
```

## Important Patterns

### Keyboard Gating

Screens must include `!isModalOpen` in their `focused` prop to prevent keyboard events from propagating when modals are open:

```typescript
<TimelineScreen
  focused={currentView === "timeline" && !showSplash && !isModalOpen}
/>
```

### Callback Closures

Callbacks passed to `openModal` capture state at call time. This is intentional - the modal operates on the data that was current when it opened:

```typescript
openModal("folder-picker", {
  tweet: selectedPost,  // Captured value
  onSelect: async (folderId) => {
    // selectedPost here is the captured value
    await client.moveBookmarkToFolder(selectedPost.id, folderId);
    closeModal();
  },
});
```

### Terminal Modals

`session-expired` is a terminal modal - `closeModal()` is a no-op when it's active. The only way out is to exit the app.

## File Structure

```
src/
├── contexts/
│   └── ModalContext.tsx      # Context, Provider, useModal, ModalRenderer
├── modals/
│   ├── README.md             # This file
│   ├── index.ts              # Re-exports
│   ├── FolderPicker.tsx
│   ├── BookmarkFolderSelector.tsx
│   ├── ExitConfirmationModal.tsx
│   └── SessionExpiredModal.tsx
```
