/**
 * Text rendering utilities for xfeed
 * Shared functions for parsing and highlighting text content
 */

import type { ReactNode } from "react";

/**
 * Extract @mentions from text and return array of usernames
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1];
    // Avoid duplicates
    if (username && !mentions.includes(username)) {
      mentions.push(username);
    }
  }

  return mentions;
}

/**
 * Render text with @mentions highlighted in a specified color using <span> inside <text>
 * Uses OpenTUI's text helper components for inline styling
 */
export function renderTextWithMentions(
  text: string,
  mentionColor: string,
  textColor: string
): ReactNode {
  // Match @username (alphanumeric and underscores)
  const mentionRegex = /@(\w+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${keyIdx++}`} fg={textColor}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    // Add the mention in the specified color
    parts.push(
      <span key={`mention-${keyIdx++}`} fg={mentionColor}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${keyIdx++}`} fg={textColor}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  // If no mentions found, just return plain text
  if (parts.length === 0) {
    return <text fg={textColor}>{text}</text>;
  }

  return <text>{parts}</text>;
}
