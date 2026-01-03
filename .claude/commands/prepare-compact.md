# Prepare for Context Compaction

## description:
Capture implementation context for seamless agent handoff before compaction.

## Arguments
$ARGUMENTS - (Optional) GitHub issue number to update, or "skip" to skip issue update

---

Prepare a comprehensive handoff document capturing the current implementation state so the next agent can continue seamlessly after context compaction.

## Steps

### 1. Gather Current State

First, collect information about the current session:

1. **Check git status** for modified files:
```bash
git status --short
git diff --stat
```

2. **Get current branch and related issue**:
```bash
git branch --show-current
```
Parse branch name for issue reference (e.g., `ainergiz/feature-123` → issue #123)

3. **Read current todo list** if the TodoWrite tool was used during the session

4. **Identify key files** that were modified or are central to the current work

### 2. Determine Related Issue

- If $ARGUMENTS is a number, use that as the issue number
- If $ARGUMENTS is "skip", skip the GitHub issue update
- If branch name contains issue number (e.g., `ainergiz/issue-42-feature`), extract it
- Otherwise, ask the user which issue this work relates to

### 3. Create Handoff Document

Write a handoff document to `.context/handoff/<timestamp>.md` with this structure:

```markdown
# Handoff: <branch-name>

**Date:** <ISO timestamp>
**Branch:** <current-branch>
**Related Issue:** #<number> (if known)

## Summary
<2-3 sentence summary of the current work>

## Completed
- [x] Item 1 that was completed
- [x] Item 2 that was completed

## In Progress
- [ ] Current task being worked on
- [ ] Description of partial work

## Remaining
- [ ] Pending item 1
- [ ] Pending item 2

## Key Files
| File | Purpose |
|------|---------|
| path/to/file1.ts | Description of changes/relevance |
| path/to/file2.ts | Description of changes/relevance |

## Decisions Made
- **Decision 1:** Rationale for the decision
- **Decision 2:** Rationale for the decision

## Blockers / Notes
- Any blockers encountered
- Important context for the next agent
- Warnings or gotchas

## Next Steps
1. First thing the next agent should do
2. Second priority task
3. Additional tasks
```

### 4. Update GitHub Issue (if not skipped)

If a related issue was identified, add a progress comment:

```bash
gh issue comment <number> --body "$(cat <<COMMENT
## Progress Update (Agent Handoff)

**Branch:** \`<branch-name>\`
**Date:** <timestamp>

### Completed
- Item 1
- Item 2

### In Progress
- Current task

### Remaining
- Pending item 1
- Pending item 2

---
*Automated handoff note for agent continuity*
COMMENT
)"
```

### 5. Confirm Handoff

Display a summary to the user:

```
## Handoff Complete

Saved to: .context/handoff/<timestamp>.md
GitHub Issue: #<number> updated (or "skipped")

### Quick Summary
- Completed: <count> items
- In Progress: <count> items
- Remaining: <count> items

The next agent can load this context by reading the handoff file.
```

## Notes

- Always be thorough - the next agent has no context
- Include file paths with line numbers for critical code sections
- Document any environment setup or dependencies needed
- If tests are failing, note which ones and why
- Mention any temporary workarounds or hacks in place
