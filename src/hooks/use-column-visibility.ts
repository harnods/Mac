"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ColumnDef = { key: string; label: string; defaultHidden?: boolean };

const listeners = new Map<string, Set<() => void>>();

function notify(storageKey: string) {
  listeners.get(storageKey)?.forEach((l) => l());
}

function readStored(storageKey: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(storageKey: string, hidden: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(hidden));
  } catch {
    // ignore unavailable storage
  }
  notify(storageKey);
}

/**
 * Per-table column show/hide state, persisted to localStorage. Built on
 * useSyncExternalStore so the SSR pass always uses `defaultHidden` (avoiding
 * a hydration mismatch), and the real stored preference is applied right
 * after the client subscribes.
 */
export function useColumnVisibility(tableId: string, columns: ColumnDef[]) {
  const storageKey = `mac:columns:${tableId}`;
  const defaultHidden = columns.filter((c) => c.defaultHidden).map((c) => c.key);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!listeners.has(storageKey)) listeners.set(storageKey, new Set());
      const set = listeners.get(storageKey)!;
      set.add(callback);
      return () => set.delete(callback);
    },
    [storageKey],
  );

  // Returning a JSON string (not the array) keeps snapshot equality working
  // via Object.is — primitive strings with identical content are ===.
  const getSnapshot = useCallback(
    () => JSON.stringify(readStored(storageKey, defaultHidden)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );
  const getServerSnapshot = useCallback(
    () => JSON.stringify(defaultHidden),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hidden = new Set<string>(JSON.parse(raw));

  function toggle(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    writeStored(storageKey, [...next]);
  }

  function isVisible(key: string) {
    return !hidden.has(key);
  }

  return { isVisible, toggle };
}
