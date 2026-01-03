#!/bin/bash
# Context Monitor Hook (UserPromptSubmit)
#
# Monitors context usage by analyzing token counts from the transcript.
# BLOCKS user messages at thresholds until /prepare-compact is run.
#
# Behavior (for 200K token context):
#   70% (140K) - BLOCK: Require /prepare-compact before continuing
#   85% (170K) - BLOCK: Strong warning, require /prepare-compact
#   95% (190K) - BLOCK: Critical, require /prepare-compact
#
# After running /prepare-compact, user can continue (state is marked as prepared)

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract paths from input
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
USER_PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

# Exit if no transcript path
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# State directory for tracking warning levels
STATE_DIR="${CLAUDE_PROJECT_DIR:-.}/.context/.state"
mkdir -p "$STATE_DIR"
STATE_FILE="$STATE_DIR/${SESSION_ID:-unknown}.json"

# Check if user is running /prepare-compact (allow it through)
if echo "$USER_PROMPT" | grep -qE '^/prepare-compact|/compact'; then
    # Mark as prepared so subsequent messages are allowed
    CURRENT_STATE=$(cat "$STATE_FILE" 2>/dev/null || echo '{}')
    echo "$CURRENT_STATE" | jq '. + {"prepared": true, "prepared_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$STATE_FILE"
    exit 0
fi

# Calculate total input tokens from transcript
# The most recent assistant message's input_tokens reflects cumulative context
TOTAL_TOKENS=$(tail -100 "$TRANSCRIPT_PATH" 2>/dev/null | \
    jq -s '[.[] | select(.message.usage.input_tokens != null) | .message.usage.input_tokens] | last // 0' 2>/dev/null || echo 0)

# If that failed, try summing cache tokens which is more accurate
if [ "$TOTAL_TOKENS" -eq 0 ]; then
    TOTAL_TOKENS=$(tail -100 "$TRANSCRIPT_PATH" 2>/dev/null | \
        jq -s '[.[] | select(.message.usage != null) |
            (.message.usage.cache_read_input_tokens // 0) +
            (.message.usage.cache_creation_input_tokens // 0) +
            (.message.usage.input_tokens // 0)] | last // 0' 2>/dev/null || echo 0)
fi

# Context limits for Opus 4.5 (200K tokens)
CONTEXT_LIMIT=200000
WARN_70=$((CONTEXT_LIMIT * 70 / 100))   # 140,000
WARN_85=$((CONTEXT_LIMIT * 85 / 100))   # 170,000
WARN_95=$((CONTEXT_LIMIT * 95 / 100))   # 190,000

# Load state
PREV_LEVEL=0
PREPARED=false
if [ -f "$STATE_FILE" ]; then
    PREV_LEVEL=$(jq -r '.warning_level // 0' "$STATE_FILE" 2>/dev/null || echo 0)
    PREPARED=$(jq -r '.prepared // false' "$STATE_FILE" 2>/dev/null || echo false)
fi

# Determine current warning level
CURRENT_LEVEL=0
if [ "$TOTAL_TOKENS" -gt "$WARN_95" ]; then
    CURRENT_LEVEL=3
elif [ "$TOTAL_TOKENS" -gt "$WARN_85" ]; then
    CURRENT_LEVEL=2
elif [ "$TOTAL_TOKENS" -gt "$WARN_70" ]; then
    CURRENT_LEVEL=1
fi

# If below threshold, allow through
if [ "$CURRENT_LEVEL" -eq 0 ]; then
    exit 0
fi

# Calculate percentage for display
PERCENT=$((TOTAL_TOKENS * 100 / CONTEXT_LIMIT))

# If user already ran /prepare-compact at this level, allow through with reminder
if [ "$PREPARED" = "true" ]; then
    # Only remind if level increased since preparation
    if [ "$CURRENT_LEVEL" -gt "$PREV_LEVEL" ]; then
        # Reset prepared flag since we've crossed a new threshold
        echo "{\"warning_level\": $CURRENT_LEVEL, \"tokens\": $TOTAL_TOKENS, \"prepared\": false, \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATE_FILE"
    else
        # Allow through silently
        exit 0
    fi
fi

# Update state (mark current level)
echo "{\"warning_level\": $CURRENT_LEVEL, \"tokens\": $TOTAL_TOKENS, \"prepared\": false, \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATE_FILE"

# Generate block message based on level
case $CURRENT_LEVEL in
    1)
        REASON="Context at ~${PERCENT}% (~${TOTAL_TOKENS} tokens). Please run /prepare-compact to save your implementation state before continuing. This ensures the next agent can pick up where you left off. After running /prepare-compact, you can continue working."
        ;;
    2)
        REASON="WARNING: Context at ~${PERCENT}% (~${TOTAL_TOKENS} tokens). Run /prepare-compact NOW to preserve your work. Compaction may happen soon. After preparing, you can continue."
        ;;
    3)
        REASON="CRITICAL: Context at ~${PERCENT}% (~${TOTAL_TOKENS} tokens). Auto-compaction is imminent! Run /prepare-compact IMMEDIATELY to save: completed work, in-progress tasks, decisions made, and next steps."
        ;;
esac

# Block the user's message and show the reason
cat <<ENDJSON
{
  "decision": "block",
  "reason": "[Context Monitor] $REASON"
}
ENDJSON

exit 0
