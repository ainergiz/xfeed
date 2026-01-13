/**
 * useAnnotations - Hook for managing bookmark annotations
 *
 * Provides functions to get, set, and delete annotations with
 * in-memory caching and immediate disk writes.
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

/**
 * Hook for managing bookmark annotations.
 * Maintains an in-memory cache with immediate disk writes.
 */
export function useAnnotations(): UseAnnotationsResult {
  // In-memory cache of annotations
  const [annotationsFile, setAnnotationsFile] = useState<AnnotationsFile>(() =>
    loadAnnotations()
  );

  // Set of annotated tweet IDs for quick lookup
  const annotatedIdsRef = useRef<Set<string>>(
    new Set(Object.keys(annotationsFile.annotations))
  );

  // Update annotatedIds when annotations change
  useEffect(() => {
    annotatedIdsRef.current = new Set(Object.keys(annotationsFile.annotations));
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

  const setAnnotation = useCallback((tweetId: string, text: string): void => {
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

      // Save immediately to disk
      saveAnnotations(updated);
      return updated;
    });
  }, []);

  const deleteAnnotation = useCallback((tweetId: string): void => {
    setAnnotationsFile((prev) => {
      if (!(tweetId in prev.annotations)) {
        return prev;
      }

      const { [tweetId]: _, ...rest } = prev.annotations;
      const updated: AnnotationsFile = {
        ...prev,
        annotations: rest,
      };

      // Save immediately to disk
      saveAnnotations(updated);
      return updated;
    });
  }, []);

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
