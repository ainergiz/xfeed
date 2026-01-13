/**
 * Annotations storage layer for bookmark annotations.
 * Stores annotations in ~/.config/xfeed/annotations.json
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(homedir(), ".config", "xfeed");
const ANNOTATIONS_PATH = path.join(CONFIG_DIR, "annotations.json");

/** Current schema version for annotations file */
const ANNOTATIONS_VERSION = 1;

/** Single annotation entry */
export interface Annotation {
  /** The annotation text */
  text: string;
  /** When the annotation was created */
  createdAt: string;
  /** When the annotation was last updated */
  updatedAt: string;
}

/** Annotations file structure */
export interface AnnotationsFile {
  version: number;
  annotations: Record<string, Annotation>;
}

/** Export format for future AI agent integration */
export interface AnnotationsExport {
  version: number;
  exportedAt: string;
  annotations: Array<{
    tweetId: string;
    text: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Load annotations from ~/.config/xfeed/annotations.json
 * Returns empty annotations object if file doesn't exist or is invalid.
 */
export function loadAnnotations(): AnnotationsFile {
  if (!existsSync(ANNOTATIONS_PATH)) {
    return { version: ANNOTATIONS_VERSION, annotations: {} };
  }

  try {
    const content = readFileSync(ANNOTATIONS_PATH, "utf-8");
    const parsed: unknown = JSON.parse(content);

    // Validate structure
    if (typeof parsed !== "object" || parsed === null) {
      return { version: ANNOTATIONS_VERSION, annotations: {} };
    }

    const file = parsed as Record<string, unknown>;

    // Check version
    if (typeof file.version !== "number") {
      return { version: ANNOTATIONS_VERSION, annotations: {} };
    }

    // Validate annotations object
    if (typeof file.annotations !== "object" || file.annotations === null) {
      return { version: ANNOTATIONS_VERSION, annotations: {} };
    }

    return {
      version: file.version,
      annotations: file.annotations as Record<string, Annotation>,
    };
  } catch {
    // Corrupt JSON - return empty annotations
    return { version: ANNOTATIONS_VERSION, annotations: {} };
  }
}

/**
 * Save annotations to ~/.config/xfeed/annotations.json
 * Creates directory if it doesn't exist.
 */
export function saveAnnotations(file: AnnotationsFile): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(ANNOTATIONS_PATH, JSON.stringify(file, null, 2) + "\n");
  chmodSync(ANNOTATIONS_PATH, 0o600);
}

/**
 * Get annotation for a specific tweet.
 * Returns undefined if no annotation exists.
 */
export function getAnnotation(tweetId: string): Annotation | undefined {
  const file = loadAnnotations();
  return file.annotations[tweetId];
}

/**
 * Set or update annotation for a tweet.
 * Creates new annotation if none exists, updates if one does.
 */
export function setAnnotation(tweetId: string, text: string): void {
  const file = loadAnnotations();
  const now = new Date().toISOString();

  const existing = file.annotations[tweetId];
  if (existing) {
    // Update existing annotation
    file.annotations[tweetId] = {
      text,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  } else {
    // Create new annotation
    file.annotations[tweetId] = {
      text,
      createdAt: now,
      updatedAt: now,
    };
  }

  saveAnnotations(file);
}

/**
 * Delete annotation for a tweet.
 * No-op if annotation doesn't exist.
 */
export function deleteAnnotation(tweetId: string): void {
  const file = loadAnnotations();

  if (file.annotations[tweetId]) {
    delete file.annotations[tweetId];
    saveAnnotations(file);
  }
}

/**
 * Export all annotations in a format suitable for AI agent integration.
 */
export function exportAnnotations(): AnnotationsExport {
  const file = loadAnnotations();

  return {
    version: file.version,
    exportedAt: new Date().toISOString(),
    annotations: Object.entries(file.annotations).map(
      ([tweetId, annotation]) => ({
        tweetId,
        text: annotation.text,
        createdAt: annotation.createdAt,
        updatedAt: annotation.updatedAt,
      })
    ),
  };
}

/**
 * Get the annotations file path (for display purposes).
 */
export function getAnnotationsPath(): string {
  return ANNOTATIONS_PATH;
}
