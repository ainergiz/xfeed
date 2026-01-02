# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

xfeed is a terminal-based X/Twitter viewer built with OpenTUI/React. It provides distraction-free browsing directly in the terminal with vim-style navigation.

## Commands

```bash
bun run start      # Run the TUI
bun run typecheck  # TypeScript type checking
bun run lint       # Check linting (oxlint + oxfmt)
bun run lint:fix   # Auto-fix lint issues
bun run test       # Run all tests (IMPORTANT: use this, not `bun test`)
```

### Testing

**Always use `bun run test`**, not `bun test` directly.

The test suite uses `mock.module()` for module mocking in `check.test.ts`, which pollutes the module cache across test files. The npm script runs tests in isolated batches to prevent this:

```bash
# Correct - runs tests in isolation
bun run test

# WRONG - will cause 130+ test failures due to mock pollution
bun test
```

For specific test files:
```bash
bun test src/api/client.test.ts          # Single file works fine
bun test -t "getTweet"                    # Filter by test name
```

## Architecture

### Layers

```
src/
├── index.tsx          # CLI entry point (cac) → auth check → launch TUI
├── app.tsx            # Main OpenTUI app component
├── api/               # Twitter GraphQL API (adapted from bird)
│   ├── client.ts      # TwitterClient class
│   ├── types.ts       # TweetData, UserData types
│   ├── query-ids.ts   # GraphQL query ID management
│   └── actions.ts     # Bookmark, Like mutations
├── auth/              # Authentication via browser cookies
│   ├── cookies.ts     # sweet-cookie integration
│   └── check.ts       # Auth validation
├── components/        # OpenTUI React components
├── screens/           # Timeline, Bookmarks, Profile views
├── hooks/             # React hooks for data fetching
├── config/            # TOML config loading
└── lib/               # Utilities (media, result types)
```

### Key Patterns

**Result Type** (`src/lib/result.ts`): Use discriminated unions for fallible operations instead of throwing:
```typescript
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }
```

**OpenTUI JSX**: Uses lowercase intrinsic elements (`<box>`, `<text>`, `<scrollbox>`) - NOT React DOM or Ink components. JSX is configured with `jsxImportSource: "@opentui/react"`.

**Twitter API**: The API layer handles Twitter's undocumented GraphQL API with rotating query IDs. Query IDs are refreshed at runtime when they change.

### Reference Code

The `.context/repos/` directory contains reference implementations:
- `bird-tui/` - Original TUI with Ink (being migrated to OpenTUI)
- `bird/` - CLI tool with TwitterClient implementation
- `opentui/`, `opencode/`, `critique/` - OpenTUI framework and examples

## Tech Stack

- **Runtime**: Bun (>= 1.0)
- **TUI Framework**: @opentui/react (NOT Ink)
- **CLI**: cac
- **Auth**: @steipete/sweet-cookie (browser cookie extraction)
- **Linting**: Oxlint + Oxfmt via Ultracite

## Code Standards

Uses Ultracite with Oxlint. Key rules enforced:
- Strict TypeScript (`noUncheckedIndexedAccess: true`)
- React hooks rules (deps arrays, no conditional hooks)
- No `any` - use `unknown` when type is genuinely unknown
- Async/await over promise chains
- Early returns over nested conditionals
