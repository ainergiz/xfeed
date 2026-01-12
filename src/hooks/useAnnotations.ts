/**
 * useAnnotations - Hook for managing bookmark annotations
 *
 * Provides functions to get, set, and delete annotations with
 * in-memory caching and lazy disk writes.
 */

import { useState, useCallback, useEffect, useRef } from "react";

import {
  loadAnnotations,
  saveAnnotations,
  type Annotation,
  type AnnotationsFile,
} from "@/config/annotations";

export interface UseAnnotationsResult {
  /** Get annotation text for a tweet (undefined if none) */
  getAnnotation: (tweetId: string) => string | undefined;
  /** Check if a tweet has an annotation */
  hasAnnotation: (tweetId: string) => boolean;
  /** Set or update annotation for a tweet */
  setAnnotation: (tweetId: string, text: string) => void;
  /** Delete annotation for a tweet */
  deleteAnnotation: (tweetId: string) => void;
  /** Get all annotation tweet IDs (for bulk checking) */
  getAnnotatedTweetIds: () => Set<string>;
}

/** Debounce delay for disk writes in ms */
const SAVE_DEBOUNCE_MS = 500;

/**
 * Hook for managing bookmark annotations.
 * Maintains an in-memory cache with debounced disk writes.
 */
export function useAnnotations(): UseAnnotationsResult {
  // In-memory cache of annotations
  const [annotationsFile, setAnnotationsFile] = useState<AnnotationsFile>(
    () => loadAnnotations()
  );

  // Track pending save timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set of annotated tweet IDs for quick lookup
  const annotatedIdsRef = useRef<Set<string>>(
    new Set(Object.keys(annotationsFile.annotations))
  );

  // Update annotatedIds when annotations change
  useEffect(() => {
    annotatedIdsRef.current = new Set(Object.keys(annotationsFile.annotations));
  }, [annotationsFile]);

  // Debounced save to disk
  const scheduleSave = useCallback((file: AnnotationsFile) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveAnnotations(file);
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save immediately on unmount if there are pending changes
        saveAnnotations(annotationsFile);
      }
    };
  }, [annotationsFile]);

  const getAnnotation = useCallback(
    (tweetId: string): string | undefined => {
      return annotationsFile.annotations[tweetId]?.text;
    },
    [annotationsFile]
  );

  const hasAnnotation = useCallback(
    (tweetId: string): boolean => {
      return tweetId in annotationsFile.annotations;
    },
    [annotationsFile]
  );

  const setAnnotation = useCallback(
    (tweetId: string, text: string): void => {
      const now = new Date().toISOString();

      setAnnotationsFile((prev) => {
        const existing = prev.annotations[tweetId];
        const newAnnotation: Annotation = existing
          ? { text, createdAt: existing.createdAt, updatedAt: now }
          : { text, createdAt: now, updatedAt: now };

        const updated: AnnotationsFile = {
          ...prev,
          annotations: {
            ...prev.annotations,
            [tweetId]: newAnnotation,
          },
        };

        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave]
  );

  const deleteAnnotation = useCallback(
    (tweetId: string): void => {
      setAnnotationsFile((prev) => {
        if (!(tweetId in prev.annotations)) {
          return prev;
        }

        const { [tweetId]: _, ...rest } = prev.annotations;
        const updated: AnnotationsFile = {
          ...prev,
          annotations: rest,
        };

        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave]
  );

  const getAnnotatedTweetIds = useCallback((): Set<string> => {
    return annotatedIdsRef.current;
  }, []);

  return {
    getAnnotation,
    hasAnnotation,
    setAnnotation,
    deleteAnnotation,
    getAnnotatedTweetIds,
  };
}
