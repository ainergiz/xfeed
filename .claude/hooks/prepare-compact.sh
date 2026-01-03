#!/bin/bash
# PreCompact Hook
#
# Triggered before context compaction (manual or auto).
# For auto-compaction, injects a critical reminder to Claude to save state.
# For manual compaction, assumes user intentionally triggered it.

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract trigger type and other data
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# Create handoff directory
HANDOFF_DIR="${CLAUDE_PROJECT_DIR:-.}/.context/handoff"
mkdir -p "$HANDOFF_DIR"

# Get current branch name
BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null || echo "unknown")

# For auto-compaction, this is critical - inject strong reminder
if [ "$TRIGGER" = "auto" ]; then
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Create a marker file so we know compaction happened
    echo "{\"trigger\": \"auto\", \"session_id\": \"$SESSION_ID\", \"branch\": \"$BRANCH\", \"timestamp\": \"$TIMESTAMP\"}" > "$HANDOFF_DIR/.last-compaction.json"

    cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "[PreCompact Hook - AUTO] Context is about to be compacted automatically due to reaching the limit. BEFORE THIS COMPACTION COMPLETES, you MUST document the current implementation state. Write a handoff note to .context/handoff/ that includes: 1) Summary of completed work, 2) Current in-progress tasks, 3) Remaining work, 4) Key files modified, 5) Important decisions made, 6) Any blockers or notes. The branch is: $BRANCH. This is your last chance to preserve context for the next agent."
  }
}
ENDJSON
fi

# For manual compaction, the user triggered /compact intentionally
# We still remind but less urgently
if [ "$TRIGGER" = "manual" ]; then
    cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "[PreCompact Hook - MANUAL] User triggered /compact. If you haven't already, consider running /prepare-compact first to save implementation context. Branch: $BRANCH"
  }
}
ENDJSON
fi

exit 0
