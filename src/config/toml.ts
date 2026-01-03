/**
 * Minimal TOML parser for simple config files.
 *
 * Supports:
 * - Section headers: [section_name]
 * - String values: key = "value" or key = 'value'
 * - Unquoted values: key = value (for simple alphanumeric values)
 * - Comments: # comment
 * - Empty lines (ignored)
 *
 * Does NOT support:
 * - Nested sections, arrays, inline tables
 * - Numbers, booleans (all values are strings)
 * - Multiline strings, escape sequences
 */

export type TomlData = Record<string, Record<string, string>>;

/**
 * Parse a simple TOML config string into a nested object.
 *
 * @param content - TOML file content
 * @returns Parsed data as { section: { key: value } }
 *
 * @example
 * parseToml('[timeline]\ndefault_tab = "following"')
 * // => { timeline: { default_tab: "following" } }
 *
 * @example
 * parseToml('[timeline]\ndefault_tab = following')
 * // => { timeline: { default_tab: "following" } }
 */
export function parseToml(content: string): TomlData {
  const result: TomlData = {};
  let currentSection = "";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    // Section header: [section_name]
    const sectionMatch = line.match(/^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/);
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1];
      result[currentSection] ??= {};
      continue;
    }

    // Key-value with quoted value: key = "value" or key = 'value'
    const quotedMatch = line.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*["'](.*)["']$/
    );
    const section = result[currentSection];
    if (quotedMatch?.[1] && quotedMatch[2] !== undefined && section) {
      section[quotedMatch[1]] = quotedMatch[2];
      continue;
    }

    // Key-value with unquoted value: key = value (alphanumeric/underscore only)
    const unquotedMatch = line.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)$/
    );
    if (unquotedMatch?.[1] && unquotedMatch[2] && section) {
      section[unquotedMatch[1]] = unquotedMatch[2];
      continue;
    }

    // Lines that don't match any pattern are silently ignored
    // This provides forward compatibility with future TOML features
  }

  return result;
}
