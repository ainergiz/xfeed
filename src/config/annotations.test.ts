/**
 * Tests for annotations storage layer
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  loadAnnotations,
  saveAnnotations,
  getAnnotation,
  setAnnotation,
  deleteAnnotation,
  exportAnnotations,
  type AnnotationsFile,
} from "./annotations";

// Use a test-specific config directory
const TEST_CONFIG_DIR = path.join(homedir(), ".config", "xfeed-test");
const TEST_ANNOTATIONS_PATH = path.join(TEST_CONFIG_DIR, "annotations.json");

// Mock the module paths for testing
const originalConfigDir = path.join(homedir(), ".config", "xfeed");
const originalAnnotationsPath = path.join(originalConfigDir, "annotations.json");

describe("annotations storage", () => {
  // Store original annotations file content if it exists
  let originalContent: string | null = null;

  beforeEach(() => {
    // Backup original file if it exists
    if (existsSync(originalAnnotationsPath)) {
      const { readFileSync } = require("node:fs");
      originalContent = readFileSync(originalAnnotationsPath, "utf-8");
    }
    // Clean up any existing test data
    if (existsSync(originalAnnotationsPath)) {
      rmSync(originalAnnotationsPath);
    }
  });

  afterEach(() => {
    // Restore original file if it existed
    if (originalContent !== null) {
      if (!existsSync(originalConfigDir)) {
        mkdirSync(originalConfigDir, { recursive: true });
      }
      writeFileSync(originalAnnotationsPath, originalContent);
    } else if (existsSync(originalAnnotationsPath)) {
      // Clean up test file if no original existed
      rmSync(originalAnnotationsPath);
    }
    originalContent = null;
  });

  describe("loadAnnotations", () => {
    it("returns empty annotations when file does not exist", () => {
      const result = loadAnnotations();
      expect(result.version).toBe(1);
      expect(result.annotations).toEqual({});
    });

    it("loads annotations from file", () => {
      const testData: AnnotationsFile = {
        version: 1,
        annotations: {
          "123": {
            text: "Test annotation",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      if (!existsSync(originalConfigDir)) {
        mkdirSync(originalConfigDir, { recursive: true });
      }
      writeFileSync(originalAnnotationsPath, JSON.stringify(testData));

      const result = loadAnnotations();
      expect(result.version).toBe(1);
      expect(result.annotations["123"]?.text).toBe("Test annotation");
    });

    it("returns empty annotations for corrupt JSON", () => {
      if (!existsSync(originalConfigDir)) {
        mkdirSync(originalConfigDir, { recursive: true });
      }
      writeFileSync(originalAnnotationsPath, "not valid json {{{");

      const result = loadAnnotations();
      expect(result.version).toBe(1);
      expect(result.annotations).toEqual({});
    });

    it("returns empty annotations for invalid structure", () => {
      if (!existsSync(originalConfigDir)) {
        mkdirSync(originalConfigDir, { recursive: true });
      }
      writeFileSync(originalAnnotationsPath, '"just a string"');

      const result = loadAnnotations();
      expect(result.version).toBe(1);
      expect(result.annotations).toEqual({});
    });
  });

  describe("saveAnnotations", () => {
    it("creates directory if it does not exist", () => {
      const testData: AnnotationsFile = {
        version: 1,
        annotations: {},
      };

      // Remove config dir if it exists
      if (existsSync(originalConfigDir)) {
        rmSync(originalConfigDir, { recursive: true });
      }

      saveAnnotations(testData);
      expect(existsSync(originalAnnotationsPath)).toBe(true);
    });

    it("saves annotations to file", () => {
      const testData: AnnotationsFile = {
        version: 1,
        annotations: {
          "456": {
            text: "Saved annotation",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      saveAnnotations(testData);
      const loaded = loadAnnotations();
      expect(loaded.annotations["456"]?.text).toBe("Saved annotation");
    });
  });

  describe("getAnnotation", () => {
    it("returns undefined for non-existent annotation", () => {
      const result = getAnnotation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns annotation when it exists", () => {
      const testData: AnnotationsFile = {
        version: 1,
        annotations: {
          "789": {
            text: "Existing annotation",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      saveAnnotations(testData);

      const result = getAnnotation("789");
      expect(result?.text).toBe("Existing annotation");
    });
  });

  describe("setAnnotation", () => {
    it("creates new annotation", () => {
      setAnnotation("new-tweet", "New annotation text");

      const result = getAnnotation("new-tweet");
      expect(result?.text).toBe("New annotation text");
      expect(result?.createdAt).toBeDefined();
      expect(result?.updatedAt).toBeDefined();
    });

    it("updates existing annotation", () => {
      setAnnotation("update-tweet", "Original text");
      const original = getAnnotation("update-tweet");

      const originalCreatedAt = original?.createdAt;

      setAnnotation("update-tweet", "Updated text");
      const updated = getAnnotation("update-tweet");

      expect(updated?.text).toBe("Updated text");
      // createdAt should remain the same when updating
      expect(updated?.createdAt).toBe(originalCreatedAt);
      // updatedAt should be set (may be same as original if executed quickly)
      expect(updated?.updatedAt).toBeDefined();
    });
  });

  describe("deleteAnnotation", () => {
    it("deletes existing annotation", () => {
      setAnnotation("delete-tweet", "To be deleted");
      expect(getAnnotation("delete-tweet")).toBeDefined();

      deleteAnnotation("delete-tweet");
      expect(getAnnotation("delete-tweet")).toBeUndefined();
    });

    it("handles deleting non-existent annotation gracefully", () => {
      // Should not throw
      deleteAnnotation("nonexistent");
      expect(getAnnotation("nonexistent")).toBeUndefined();
    });
  });

  describe("exportAnnotations", () => {
    it("exports empty annotations", () => {
      const result = exportAnnotations();
      expect(result.version).toBe(1);
      expect(result.exportedAt).toBeDefined();
      expect(result.annotations).toEqual([]);
    });

    it("exports all annotations", () => {
      setAnnotation("export-1", "First annotation");
      setAnnotation("export-2", "Second annotation");

      const result = exportAnnotations();
      expect(result.annotations.length).toBe(2);
      expect(result.annotations.some((a) => a.tweetId === "export-1")).toBe(true);
      expect(result.annotations.some((a) => a.tweetId === "export-2")).toBe(true);
    });
  });
});
