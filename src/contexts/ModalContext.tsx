/**
 * ModalContext - Centralized modal management with type-safe discriminated unions
 *
 * Provides:
 * - ModalProvider: Wraps app, manages state, renders modals at root level
 * - useModal: Hook to open/close modals from any component
 *
 * Usage:
 *   const { openModal, closeModal } = useModal();
 *   openModal("folder-picker", { client, tweet, onSelect, onClose });
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { XClient } from "@/api/client";
import type { BookmarkFolder, TweetData } from "@/api/types";

import { BookmarkFolderSelector } from "@/modals/BookmarkFolderSelector";
import { ExitConfirmationModal } from "@/modals/ExitConfirmationModal";
import { FolderPicker } from "@/modals/FolderPicker";
import { SessionExpiredModal } from "@/modals/SessionExpiredModal";

// ============================================================================
// Modal Type Definitions
// ============================================================================

/** Modal type identifiers */
export type ModalType =
  | "folder-picker"
  | "bookmark-folder-selector"
  | "exit-confirmation"
  | "session-expired";

/** Props for FolderPicker modal */
export interface FolderPickerModalProps {
  client: XClient;
  tweet: TweetData;
  onSelect: (folderId: string, folderName: string) => Promise<void>;
  onClose: () => void;
}

/** Props for BookmarkFolderSelector modal */
export interface BookmarkFolderSelectorModalProps {
  client: XClient;
  currentFolder: BookmarkFolder | null;
  onSelect: (folder: BookmarkFolder | null) => void;
  onClose: () => void;
}

/** Props for ExitConfirmationModal */
export interface ExitConfirmationModalProps {
  onLogout: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Props for SessionExpiredModal (terminal - no props needed) */
export interface SessionExpiredModalProps {}

/** Map of modal type to its props type for type inference */
export interface ModalPropsMap {
  "folder-picker": FolderPickerModalProps;
  "bookmark-folder-selector": BookmarkFolderSelectorModalProps;
  "exit-confirmation": ExitConfirmationModalProps;
  "session-expired": SessionExpiredModalProps;
}

/** Discriminated union of all possible modal states */
export type ModalState =
  | { type: "folder-picker"; props: FolderPickerModalProps }
  | {
      type: "bookmark-folder-selector";
      props: BookmarkFolderSelectorModalProps;
    }
  | { type: "exit-confirmation"; props: ExitConfirmationModalProps }
  | { type: "session-expired"; props: SessionExpiredModalProps }
  | null;

// ============================================================================
// Context Definition
// ============================================================================

/** Context value exposed to consumers */
export interface ModalContextValue {
  /** Currently active modal state (null if no modal open) */
  activeModal: ModalState;

  /** Open a modal with type-safe props */
  openModal: <T extends ModalType>(type: T, props: ModalPropsMap[T]) => void;

  /** Close the current modal (no-op if session-expired is showing) */
  closeModal: () => void;

  /** Whether any modal is currently open (for keyboard gating) */
  isModalOpen: boolean;

  /** Whether the session-expired modal is showing (terminal state) */
  isSessionExpired: boolean;
}

const ModalContext = createContext<ModalContextValue | null>(null);

// ============================================================================
// ModalRenderer Component
// ============================================================================

interface ModalRendererProps {
  activeModal: ModalState;
}

function ModalRenderer({ activeModal }: ModalRendererProps) {
  if (!activeModal) {
    return null;
  }

  // Absolute positioning wrapper - consistent for all modals
  const ModalWrapper = ({ children }: { children: ReactNode }) => (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </box>
  );

  switch (activeModal.type) {
    case "folder-picker":
      return (
        <ModalWrapper>
          <FolderPicker {...activeModal.props} focused={true} />
        </ModalWrapper>
      );

    case "bookmark-folder-selector":
      return (
        <ModalWrapper>
          <BookmarkFolderSelector {...activeModal.props} focused={true} />
        </ModalWrapper>
      );

    case "exit-confirmation":
      return (
        <ModalWrapper>
          <ExitConfirmationModal {...activeModal.props} focused={true} />
        </ModalWrapper>
      );

    case "session-expired":
      // SessionExpiredModal includes its own absolute positioning
      return <SessionExpiredModal />;
  }
}

// ============================================================================
// ModalProvider Component
// ============================================================================

interface ModalProviderProps {
  children: ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const openModal = useCallback(
    <T extends ModalType>(type: T, props: ModalPropsMap[T]) => {
      // Type assertion needed due to discriminated union mapping
      setActiveModal({ type, props } as ModalState);
    },
    []
  );

  const closeModal = useCallback(() => {
    setActiveModal((current) => {
      // Don't allow closing session-expired modal (terminal state)
      if (current?.type === "session-expired") {
        return current;
      }
      return null;
    });
  }, []);

  const isModalOpen = activeModal !== null;
  const isSessionExpired = activeModal?.type === "session-expired";

  const contextValue: ModalContextValue = {
    activeModal,
    openModal,
    closeModal,
    isModalOpen,
    isSessionExpired,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      <ModalRenderer activeModal={activeModal} />
    </ModalContext.Provider>
  );
}

// ============================================================================
// useModal Hook
// ============================================================================

/**
 * Hook to access modal context
 * @throws Error if used outside ModalProvider
 */
export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
