# Contributing to xfeed

Thank you for your interest in contributing to xfeed!

## Before You Start

**Please open an issue first** before starting work on any significant changes. 

Ask your agent to use "new issue" skill which prompt it to look for duplicate issues and also put down a plan of implementation. 

## Pull Request Requirements

All pull requests must reference a GitHub issue (e.g., `#123` or `Fixes #123`) in the title or body. Our CI will automatically check for this and fail if no issue is referenced.

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Run the app:
   ```bash
   bun run start
   ```

### Reference Repos

Since OpenTUI is a very new library, I strongly suggest cloning reference repos while developing new features. Use the sync-context script to clone them:

```bash
bun run sync-context
```

This reads from `conductor.json` and clones repos to `.context/repos/`. See [conductor.json docs](https://docs.conductor.build/core/conductor-json) for configuration details.

## Commands

```bash
bun run start      # Run the TUI
bun run typecheck  # TypeScript type checking
bun run lint       # Check linting
bun run lint:fix   # Auto-fix lint issues
bun run test       # Run tests (important: use this, not `bun test`)
```

## Code Standards

- TypeScript with strict mode
- Use `unknown` over `any`
- Async/await over promise chains
- Early returns over nested conditionals

## Testing

Always use `bun run test` instead of `bun test` directly. The test suite requires isolation to prevent mock pollution between test files.

## Questions?

Open an issue with your question and we'll be happy to help.
