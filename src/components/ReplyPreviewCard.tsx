/**
 * ReplyPreviewCard - Compact nested reply preview
 * Similar to QuotedPostCard but strips leading @mentions
 */

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import { truncateText } from "@/lib/format";

const MAX_TEXT_LINES = 2;
const PREVIEW_BORDER_COLOR = "#444444";
const PREVIEW_BG = "#0d0d14";

interface ReplyPreviewCardProps {
  reply: TweetData;
  /** Usernames to strip from leading @mentions */
  stripMentions: string[];
}

/**
 * Strip leading @mentions that match any of the provided usernames.
 * Continues stripping while mentions at the start match the list.
 */
function stripLeadingMentions(text: string, usernames: string[]): string {
  let result = text;
  const lowerUsernames = new Set(usernames.map((u) => u.toLowerCase()));

  // Keep stripping while there's a matching @mention at the start
  let changed = true;
  while (changed) {
    changed = false;
    for (const username of lowerUsernames) {
      const pattern = new RegExp(`^@${username}\\s*`, "i");
      const newResult = result.replace(pattern, "");
      if (newResult !== result) {
        result = newResult;
        changed = true;
        break;
      }
    }
  }

  return result;
}

export function ReplyPreviewCard({
  reply,
  stripMentions,
}: ReplyPreviewCardProps) {
  const cleanText = stripLeadingMentions(reply.text, stripMentions);
  const displayText = truncateText(cleanText, MAX_TEXT_LINES);

  return (
    <box style={{ flexDirection: "row", marginTop: 1 }}>
      {/* Left border indicator */}
      <text fg={PREVIEW_BORDER_COLOR}>│ </text>

      {/* Reply preview content */}
      <box
        style={{
          flexDirection: "column",
          backgroundColor: PREVIEW_BG,
          paddingRight: 1,
        }}
      >
        {/* Nested reply author line */}
        <box style={{ flexDirection: "row" }}>
          <text fg={colors.primary}>@{reply.author.username}</text>
          <text fg={colors.dim}> · {reply.author.name}</text>
        </box>

        {/* Reply text (truncated) */}
        <box style={{ marginTop: 1 }}>
          <text fg="#aaaaaa">{displayText}</text>
        </box>
      </box>
    </box>
  );
}
