/**
 * Preload file for preferences.test.ts
 * Sets up module mocks BEFORE any imports occur.
 *
 * Run with: bun test --preload ./src/config/preferences.test.preload.ts src/config/preferences.test.ts
 */

import { mock } from "bun:test";

// Mock file content - tests can update this
export let mockFileExists = false;
export let mockFileContent = "";

// Helper functions to update mocks from tests
export function setMockFile(exists: boolean, content = "") {
  mockFileExists = exists;
  mockFileContent = content;
}

export function resetMocks() {
  mockFileExists = false;
  mockFileContent = "";
}

// Mock node:fs module
mock.module("node:fs", () => ({
  existsSync: () => mockFileExists,
  readFileSync: () => mockFileContent,
}));
