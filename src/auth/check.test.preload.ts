/**
 * Preload file for check.test.ts
 * Sets up module mocks BEFORE any imports occur, preventing pollution.
 *
 * Run with: bun test --preload ./src/auth/check.test.preload.ts src/auth/check.test.ts
 */

import { mock } from "bun:test";

import type { XCookies } from "./cookies";

// Export mutable mock implementations that tests can update
export let mockResolveCredentialsImpl: (options: unknown) => Promise<{
  cookies: XCookies;
  warnings: string[];
}> = () =>
  Promise.resolve({
    cookies: {
      authToken: "test-auth-token",
      ct0: "test-ct0",
      cookieHeader: "auth_token=test-auth-token; ct0=test-ct0",
      source: "test",
    },
    warnings: [],
  });

export let mockGetCurrentUserImpl: () => Promise<{
  success: boolean;
  user?: { id: string; username: string; name: string };
  error?: string;
}> = () =>
  Promise.resolve({
    success: true,
    user: { id: "123", username: "testuser", name: "Test User" },
  });

export let lastClientOptions: {
  cookies: XCookies;
  timeoutMs?: number;
} | null = null;

// Helper functions to update mocks from tests
export function setMockResolveCredentials(
  impl: typeof mockResolveCredentialsImpl
) {
  mockResolveCredentialsImpl = impl;
}

export function setMockGetCurrentUser(impl: typeof mockGetCurrentUserImpl) {
  mockGetCurrentUserImpl = impl;
}

export function resetMocks() {
  mockResolveCredentialsImpl = () =>
    Promise.resolve({
      cookies: {
        authToken: "test-auth-token",
        ct0: "test-ct0",
        cookieHeader: "auth_token=test-auth-token; ct0=test-ct0",
        source: "test",
      },
      warnings: [],
    });

  mockGetCurrentUserImpl = () =>
    Promise.resolve({
      success: true,
      user: { id: "123", username: "testuser", name: "Test User" },
    });

  lastClientOptions = null;
}

export function setLastClientOptions(
  options: { cookies: XCookies; timeoutMs?: number } | null
) {
  lastClientOptions = options;
}

// Mock modules BEFORE they're imported anywhere
mock.module("./cookies", () => ({
  resolveCredentials: (options: unknown) => mockResolveCredentialsImpl(options),
}));

mock.module("@/api/client", () => ({
  XClient: class MockXClient {
    constructor(options: { cookies: XCookies; timeoutMs?: number }) {
      lastClientOptions = options;
    }
    getCurrentUser() {
      return mockGetCurrentUserImpl();
    }
  },
}));
