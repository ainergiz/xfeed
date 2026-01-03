// @ts-nocheck - Test file with module mocking
/**
 * Unit tests for preferences.ts
 * Tests loading and validation of user preferences
 *
 * NOTE: This test uses a preload file for module mocking to avoid
 * polluting other test files. Run with:
 *   bun test --preload ./src/config/preferences.test.preload.ts src/config/preferences.test.ts
 */

import { beforeEach, describe, expect, it } from "bun:test";

import { resetMocks, setMockFile } from "./preferences.test.preload";

// Import the module under test (mocks are set up by preload)
const { loadPreferences, getPreferencesPath } = await import("./preferences");
const { DEFAULT_PREFERENCES } = await import("./preferences-types");

describe("preferences", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("loadPreferences", () => {
    it("returns defaults when file does not exist", () => {
      setMockFile(false);

      const result = loadPreferences();

      expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.warnings).toEqual([]);
    });

    it("returns defaults for empty file", () => {
      setMockFile(true, "");

      const result = loadPreferences();

      expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.warnings).toEqual([]);
    });

    it("returns defaults for whitespace-only file", () => {
      setMockFile(true, "   \n  \n  ");

      const result = loadPreferences();

      expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.warnings).toEqual([]);
    });

    it("parses valid timeline.default_tab = for_you", () => {
      setMockFile(true, '[timeline]\ndefault_tab = "for_you"');

      const result = loadPreferences();

      expect(result.preferences.timeline.default_tab).toBe("for_you");
      expect(result.warnings).toEqual([]);
    });

    it("parses valid timeline.default_tab = following", () => {
      setMockFile(true, '[timeline]\ndefault_tab = "following"');

      const result = loadPreferences();

      expect(result.preferences.timeline.default_tab).toBe("following");
      expect(result.warnings).toEqual([]);
    });

    it("warns on invalid timeline.default_tab and uses default", () => {
      setMockFile(true, '[timeline]\ndefault_tab = "invalid"');

      const result = loadPreferences();

      expect(result.preferences.timeline.default_tab).toBe("for_you");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Invalid timeline.default_tab");
      expect(result.warnings[0]).toContain('"invalid"');
      expect(result.warnings[0]).toContain("for_you, following");
    });

    it("ignores unknown sections", () => {
      setMockFile(
        true,
        '[unknown]\nfoo = "bar"\n\n[timeline]\ndefault_tab = "following"'
      );

      const result = loadPreferences();

      expect(result.preferences.timeline.default_tab).toBe("following");
      expect(result.warnings).toEqual([]);
    });

    it("ignores unknown keys in known sections", () => {
      setMockFile(
        true,
        '[timeline]\nunknown_key = "value"\ndefault_tab = "following"'
      );

      const result = loadPreferences();

      expect(result.preferences.timeline.default_tab).toBe("following");
      expect(result.warnings).toEqual([]);
    });

    it("handles file with only comments", () => {
      setMockFile(true, "# This is a comment\n# Another comment");

      const result = loadPreferences();

      expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("getPreferencesPath", () => {
    it("returns path ending with preferences.toml", () => {
      const path = getPreferencesPath();

      expect(path).toContain("preferences.toml");
      expect(path).toContain(".config");
      expect(path).toContain("xfeed");
    });
  });
});
