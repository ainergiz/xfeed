/**
 * TanStack Router Validation Spike
 *
 * Tests that TanStack Router works with OpenTUI's custom React renderer.
 * Success criteria:
 * - RouterProvider renders without errors
 * - useNavigate() triggers route changes
 * - Components re-render on navigation
 * - useParams() correctly extracts route parameters
 * - Back navigation works (navigate({ to: "..", }))
 */

import { useKeyboard } from "@opentui/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useParams,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";

import { colors } from "@/lib/colors";

// ============================================================================
// Route Definitions
// ============================================================================

// ============================================================================
// Default Components (OpenTUI-compatible replacements for HTML defaults)
// ============================================================================

function DefaultPendingComponent() {
  return (
    <box style={{ padding: 1 }}>
      <text fg={colors.dim}>Loading...</text>
    </box>
  );
}

function DefaultErrorComponent({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  return (
    <box style={{ padding: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={colors.error}>Error: </text>
        <text fg={colors.error}>{message}</text>
      </box>
      {error instanceof Error && error.stack && (
        <text fg={colors.dim}>
          {error.stack.split("\n").slice(0, 5).join("\n")}
        </text>
      )}
    </box>
  );
}

function DefaultNotFoundComponent() {
  return (
    <box style={{ padding: 1 }}>
      <text fg={colors.warning}>Page not found</text>
    </box>
  );
}

// Root route - provides the layout shell
const rootRoute = createRootRoute({
  component: RootLayout,
  // Provide OpenTUI-compatible default components to prevent HTML element errors
  pendingComponent: DefaultPendingComponent,
  errorComponent: DefaultErrorComponent,
  notFoundComponent: DefaultNotFoundComponent,
});

function RootLayout() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {/* Header showing current route */}
      <box
        style={{
          height: 3,
          borderStyle: "single",
          justifyContent: "space-between",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text>TanStack Router Spike</text>
        <text fg={colors.primary}>Path: {currentPath}</text>
      </box>

      {/* Route content */}
      <box style={{ flexGrow: 1 }}>
        <Outlet />
      </box>

      {/* Footer with navigation hints */}
      <box style={{ height: 1, paddingLeft: 1 }}>
        <text fg={colors.dim}>
          [1] Timeline [2] Post/123 [3] Profile/test [b] Back [q] Quit
        </text>
      </box>
    </box>
  );
}

// Index route (timeline)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TimelineView,
});

function TimelineView() {
  const navigate = useNavigate();

  useKeyboard((key) => {
    if (key.name === "return") {
      // Navigate to a post detail
      navigate({ to: "/post/$postId", params: { postId: "abc123" } });
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
      }}
    >
      <text fg="#ffffff">Timeline View</text>
      <text fg={colors.success}>✓ Index route rendered successfully</text>
      <text />
      <text>Press Enter to navigate to /post/abc123</text>
    </box>
  );
}

// Post detail route with params
const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/post/$postId",
  component: PostDetailView,
});

function PostDetailView() {
  const { postId } = useParams({ from: "/post/$postId" });
  const navigate = useNavigate();

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "b") {
      // Navigate back
      navigate({ to: "/" });
    }
    if (key.name === "@") {
      // Navigate to profile
      navigate({ to: "/profile/$username", params: { username: "testuser" } });
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
      }}
    >
      <text fg="#ffffff">Post Detail View</text>
      <text fg={colors.success}>✓ Route params extracted successfully</text>
      <text />
      <box style={{ flexDirection: "row" }}>
        <text>Post ID: </text>
        <text fg={colors.warning}>{postId}</text>
      </box>
      <text />
      <text>Press [b] or [Esc] to go back, [@] to view profile</text>
    </box>
  );
}

// Profile route with params
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile/$username",
  component: ProfileView,
});

function ProfileView() {
  const { username } = useParams({ from: "/profile/$username" });
  const router = useRouter();

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "b") {
      // Use router.history.back() for true back navigation
      router.history.back();
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
      }}
    >
      <text fg="#ffffff">Profile View</text>
      <text fg={colors.success}>✓ Nested navigation working</text>
      <text />
      <box style={{ flexDirection: "row" }}>
        <text>Username: </text>
        <text fg={colors.warning}>@{username}</text>
      </box>
      <text />
      <text>Press [b] or [Esc] to go back (history.back)</text>
    </box>
  );
}

// ============================================================================
// Router Setup
// ============================================================================

// Build the route tree
const routeTree = rootRoute.addChildren([indexRoute, postRoute, profileRoute]);

// Create memory history (required for non-browser environments)
const memoryHistory = createMemoryHistory({
  initialEntries: ["/"],
});

// Create the router instance
const router = createRouter({
  routeTree,
  history: memoryHistory,
  // Critical: tell router we're not on a server (document is undefined in TUI)
  isServer: false,
  // Provide a fake origin since window is not available
  origin: "http://localhost",
  // Provide OpenTUI-compatible default components for ALL routes
  // This prevents TanStack Router from using its HTML-based defaults
  defaultPendingComponent: DefaultPendingComponent,
  defaultErrorComponent: DefaultErrorComponent,
  defaultNotFoundComponent: DefaultNotFoundComponent,
});

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * RouterSpike - The main component to test TanStack Router with OpenTUI
 *
 * Wrap this with your OpenTUI app to test routing.
 */
export function RouterSpike() {
  return <RouterProvider router={router} />;
}

/**
 * RouterSpikeWithKeyboard - Version with global keyboard navigation
 *
 * Adds number keys to jump between routes for testing.
 * Uses a wrapper component since RouterProvider doesn't accept children.
 */
export function RouterSpikeWithKeyboard() {
  return (
    <box style={{ height: "100%" }}>
      <GlobalKeyboardNav />
      <RouterProvider router={router} />
    </box>
  );
}

function GlobalKeyboardNav() {
  useKeyboard((key) => {
    if (key.name === "1") {
      router.navigate({ to: "/" });
    }
    if (key.name === "2") {
      router.navigate({ to: "/post/$postId", params: { postId: "123" } });
    }
    if (key.name === "3") {
      router.navigate({
        to: "/profile/$username",
        params: { username: "test" },
      });
    }
    if (key.name === "b") {
      router.history.back();
    }
    if (key.name === "q") {
      process.exit(0);
    }
  });

  return null;
}
